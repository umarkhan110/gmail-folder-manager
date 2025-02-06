/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getStoredToken } from "@/lib/tokenStore";
import { analyzeFolderMatch } from "@/lib/openai-service";
import { cleanEmailContent } from "@/lib/emailParser";

const processedMessages = new Map<string, number>();
//const DUPLICATE_WINDOW_MS = 60000; // 1 minute window

export async function POST(request: Request) {
    console.log("\n=== Incoming Gmail Pub/Sub Notification ===");

    // try {
    const body = await request.json();
    //let body;
    // // ✅ Handle JSON Parsing Errors
    // try {
    //     body = JSON.parse(rawBody);
    // } catch (jsonError) {
    //     console.error("❌ JSON Parsing Error:", jsonError);
    //     return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    // }

    if (!body.message || !body.message.data) {
        return NextResponse.json({ error: "Invalid Pub/Sub message structure" }, { status: 400 });
    }

    console.log("📨 Encoded Message:", body.message.data);
    // ✅ Decode Base64 message
    // let decodedMessage;
    // try {
    const decodedMessage = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf-8"));
    // } catch (decodeError) {
    //     console.error("❌ Error decoding message data:", decodeError);
    //     return NextResponse.json({ error: "Failed to decode message" }, { status: 400 });
    // }
    console.log("📩 Decoded Message:", decodedMessage);

    // let parsedData;
    // try {
    //     parsedData = JSON.parse(decodedMessage);
    // } catch (jsonError) {
    //     console.error("❌ JSON Parsing Error for Decoded Message:", jsonError);
    //     return NextResponse.json({ error: "Invalid decoded JSON" }, { status: 400 });
    // }

    const historyId = decodedMessage.historyId;
    if (!historyId) {
        console.error("❌ Missing historyId in notification");
        return NextResponse.json({ error: "Invalid Google notification" }, { status: 400 });
    }




    // Fetch stored Google History ID
    const user = await prisma.userSubscription.findUnique({
        where: { userId: decodedMessage.emailAddress },
    });

    let startHistoryId = user?.googleHistoryId;
    console.log("🔍 Stored History ID:", user?.googleHistoryId);








    // ✅ Handle Duplicate Notifications
    // const lastProcessed = processedMessages.get(historyId);
    const currentTimestamp = Date.now();
    // if (lastProcessed && currentTimestamp - lastProcessed < DUPLICATE_WINDOW_MS) {
    //     console.log("🔁 Duplicate notification ignored");
    //     return NextResponse.json({ success: true });
    // }

    // ✅ Fetch OAuth Token
    const accessToken = await getStoredToken();
    console.log("🔑 Access Token:", accessToken);
    if (!accessToken) {
        console.error("❌ No valid access token available");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Authenticate Gmail API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    let gmail;
    try {
        gmail = google.gmail({ version: "v1", auth });
    } catch (authError) {
        console.error("❌ Gmail API Authentication Error:", authError);
        return NextResponse.json({ error: "Failed to authenticate with Gmail API" }, { status: 500 });
    }

    console.log("🔑 Authenticated with Gmail API");


    let history;

    // If no stored historyId, initialize it
    if (!startHistoryId) {
        // try {

        try {
            // Save the new historyId to the user's subscription
            if (historyId) {
                await prisma.userSubscription.update({
                    where: { userId: decodedMessage.emailAddress },
                    data: { googleHistoryId: String(historyId) },
                });
                startHistoryId = historyId;
            }
        } catch (error) {
            console.error("❌ Error updating historyID:", error);
        }

        //     history = await gmail.users.history.list({
        //         userId: "me",
        //         startHistoryId: String(historyId),
        //         historyTypes: ["messageAdded"],
        //     });

        // } catch (historyError: any) {
        //     if (historyError.code === 404) {
        //         console.log("⚠️ History ID out of range, ignoring notification.");
        //         return NextResponse.json({ success: true });
        //     }
        //     console.error("❌ Error fetching Gmail history:", historyError);
        //     return NextResponse.json({ error: "Failed to fetch Gmail history" }, { status: 500 });
        // }
    }
    // ✅ Fetch Gmail History Changes
    try {
        history = await gmail.users.history.list({
            userId: "me",
            startHistoryId: String(startHistoryId),
            historyTypes: ["messageAdded"],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (historyError: any) {
        if (historyError.code === 404) {
            console.log("⚠️ History ID out of range, ignoring notification.");
            return NextResponse.json({ success: true });
        }
        console.error("❌ Error fetching Gmail history:", historyError);
        return NextResponse.json({ error: "Failed to fetch Gmail history" }, { status: 500 });
    }
    // if (!history) {
    //     console.log("❌ Error fetching history----");
    //     return NextResponse.json({ error: "Failed to fetch Gmail history" }, { status: 500 });
    // }

    console.log("📨 Gmail History Changes:", history.data);
    try {
        // Save the new historyId to the user's subscription
        if (historyId) {
            await prisma.userSubscription.update({
                where: { userId: decodedMessage.emailAddress },
                data: { googleHistoryId: String(history.data.historyId) },
            });
        }
    } catch (error) {
        console.error("❌ Error updating new historyID:", error);
    }

    // ✅ Process Email Change
    if (history.data.history && history.data.history?.length > 0) {
        const messageChange = history.data.history[0].messages?.[0];

        if (messageChange) {
            let message;
            try {
                message = await gmail.users.messages.get({
                    userId: "me",
                    id: messageChange.id!,
                    format: "full",
                });
            } catch (messageError) {
                console.error("❌ Error fetching email message:", messageError);
                return NextResponse.json({ error: "Failed to fetch email" }, { status: 500 });
            }

            const headers = message.data.payload?.headers || [];
            const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
            const from = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
            const body = cleanEmailContent(message.data.snippet || "");

            console.log("📧 New Email Received:");
            console.log(`  ➡ Subject: ${subject}`);
            console.log(`  ➡ Sender: ${from}`);
            console.log(`  ➡ Body: ${body}`);
            console.log(`  ➡ Message ID: ${messageChange.id}`);

            // ✅ Fetch User Labels (Folders)
            let labels;
            try {
                labels = await gmail.users.labels.list({ userId: "me" });
            } catch (labelError) {
                console.error("❌ Error fetching Gmail labels:", labelError);
                return NextResponse.json({ error: "Failed to fetch email folders" }, { status: 500 });
            }

            // ✅ Match AI Categorized Folder
            const folderDescriptions = await prisma.folderDescription.findMany();
            const availableFolders = folderDescriptions.filter((desc) =>
                labels.data.labels?.some((l) => l.name?.toLowerCase() === desc.displayName.toLowerCase())
            );

            const suggestedFolder = await analyzeFolderMatch({ subject, body }, availableFolders, false);
            console.log(`📂 Suggested Folder: ${suggestedFolder}`);

            // ✅ Move Email if Folder Exists
            if (suggestedFolder) {
                const targetLabel = labels.data.labels?.find(
                    (l) => l.name?.toLowerCase() === suggestedFolder.toLowerCase()
                );

                if (targetLabel) {
                    try {
                        await gmail.users.messages.modify({
                            userId: "me",
                            id: messageChange.id!,
                            requestBody: {
                                addLabelIds: [targetLabel.id!],
                                removeLabelIds: ["INBOX"],
                            },
                        });
                        console.log(`✅ Email moved to: ${suggestedFolder}`);
                    } catch (moveError) {
                        console.error("❌ Error moving email to folder:", moveError);
                        return NextResponse.json({ error: "Failed to move email" }, { status: 500 });
                    }
                } else {
                    console.log(`⚠️ Folder "${suggestedFolder}" not found.`);
                }
            }

            // ✅ Prevent Duplicate Processing
            processedMessages.set(historyId, currentTimestamp);
        }
    }

    return NextResponse.json({ success: true });
    // } catch (error) {
    //     console.error("❌ Unexpected Server Error:", error);
    //     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    // }
}



//     // ✅ Google Pub/Sub verification request handling
//     //   if (request.headers.get("X-Goog-Resource-State") === "sync") {
//     //     console.log("Google Pub/Sub Verification Request");
//     //     return new Response("OK", { status: 200 });
//     //   }

//     //   // ✅ Validation token for subscription verification
//     //   const validationToken = new URL(request.url).searchParams.get("validationToken");
//     //   if (validationToken) {
//     //     console.log("Received validation request:", validationToken);
//     //     return new Response(validationToken, {
//     //       status: 200,
//     //       headers: { "Content-Type": "text/plain" },
//     //     });
//     //   }

//         // ✅ Verify Google Pub/Sub JWT token (to ensure request is from Google)
//         // const jwtToken = request.headers.get("Authorization")?.split("Bearer ")[1];
//         // if (!jwtToken || !(await verifyGooglePubSubJWT(jwtToken))) {
//         //   console.error("Invalid JWT signature from Google Pub/Sub");
//         //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
//         // }