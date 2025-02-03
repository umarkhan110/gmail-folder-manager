// import { NextResponse } from "next/server";
// import { google } from "googleapis";
// import { prisma } from "@/lib/prisma";
// import { getStoredToken } from "@/lib/tokenStore";
// import { analyzeFolderMatch } from "@/lib/openai-service";
// import { cleanEmailContent } from "@/lib/emailParser";
// // import { verifyGooglePubSubJWT } from "@/lib/googlePubSubVerifier";

// // Deduplication: Store processed message IDs (Consider Redis for better persistence)
// const processedMessages = new Map<string, number>();
// const DUPLICATE_WINDOW_MS = 60000; // 1 minute

// export async function POST(request: Request) {
//     console.log("\n=== Incoming Gmail Pub/Sub Notification ===");

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

//     try {
//         // ✅ Verify Google Pub/Sub JWT token (to ensure request is from Google)
//         // const jwtToken = request.headers.get("Authorization")?.split("Bearer ")[1];
//         // if (!jwtToken || !(await verifyGooglePubSubJWT(jwtToken))) {
//         //   console.error("Invalid JWT signature from Google Pub/Sub");
//         //   return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
//         // }

//         const rawBody = await request.text();
//         const body = JSON.parse(rawBody);

//         if (!body.message || !body.message.data) {
//             return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
//         }

//         // Decode the Base64-encoded message data
//         const decodedMessage = Buffer.from(body.message.data, "base64").toString("utf-8");

//         const parsedData = JSON.parse(decodedMessage);

//         const historyId = parsedData.historyId;
//         if (!historyId) {
//             console.error("No historyId in Google notification");
//             return NextResponse.json({ error: "Invalid Google notification" }, { status: 400 });
//         }
//         // ✅ Get OAuth Token
//         const accessToken = await getStoredToken();
//         if (!accessToken) {
//             console.error("No valid access token available");
//             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//         }

//         // ✅ Authenticate Gmail API
//         const auth = new google.auth.OAuth2();
//         auth.setCredentials({ access_token: accessToken });
//         const gmail = google.gmail({ version: "v1", auth });

//         // ✅ Fetch recent Gmail changes
//         const history = await gmail.users.history.list({
//             userId: "me",
//             startHistoryId: String(historyId),
//         });
// console.log(history)
//         if (!history.data.history) {
//             console.log("✅ No new emails found.");
//             return NextResponse.json({ success: true });
//         }

//         console.log("📨 Gmail History Changes:", history.data);


//         for (const record of history.data.history) {
//           if (!record.messages) continue;

//           for (const msg of record.messages) {
//             // ✅ Deduplicate message processing
//             // if (processedMessages.has(msg.id!)) {
//             //   console.log(`Skipping duplicate Gmail message: ${msg.id}`);
//             //   continue;
//             // }
//             // processedMessages.set(msg.id!, Date.now());

//             // ✅ Fetch email details
//             const message = await gmail.users.messages.get({
//               userId: "me",
//               id: msg.id!,
//               format: "full",
//             });

//             const headers = message.data.payload?.headers || [];
//             const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
//             const body = cleanEmailContent(message.data.snippet || "");

//             console.log("📧 New Email:");
//             console.log(`Subject: ${subject}`);
//             console.log(`Body: ${body}`);

//             // ✅ Fetch user folders (Gmail Labels)
//             const labels = await gmail.users.labels.list({ userId: "me" });

//             // ✅ Match folders for AI-based email categorization
//             const folderDescriptions = await prisma.folderDescription.findMany();
//             const availableFolders = folderDescriptions.filter((desc) =>
//               labels.data.labels?.some((l) => l.name?.toLowerCase() === desc.displayName.toLowerCase())
//             );

//             const suggestedFolder = await analyzeFolderMatch({ subject, body }, availableFolders, false);

//             console.log(`📂 Suggested Folder: ${suggestedFolder}`);

//             // ✅ Move Email to Suggested Folder
//             if (suggestedFolder) {
//               const targetLabel = labels.data.labels?.find(
//                 (l) => l.name?.toLowerCase() === suggestedFolder.toLowerCase()
//               );

//               if (targetLabel) {
//                 await gmail.users.messages.modify({
//                   userId: "me",
//                   id: msg.id!,
//                   requestBody: { addLabelIds: [targetLabel.id!] },
//                 });
//                 console.log(`✅ Email moved to folder: ${suggestedFolder}`);
//               } else {
//                 console.log(`⚠️ Folder "${suggestedFolder}" not found.`);
//               }
//             }
//           }
//         }

//         return NextResponse.json({ success: true });
//     } catch (error) {
//         console.error("❌ Error processing pubsub notification:", error);
//         return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
//     }
// }


import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getStoredToken } from "@/lib/tokenStore";
import { analyzeFolderMatch } from "@/lib/openai-service";
import { cleanEmailContent } from "@/lib/emailParser";

const processedMessages = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 60000; // 1 minute window

export async function POST(request: Request) {
    console.log("\n=== Incoming Gmail Pub/Sub Notification ===");

    try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);

        if (!body.message || !body.message.data) {
            return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
        }

        // Decode the Base64-encoded message data
        const decodedMessage = Buffer.from(body.message.data, "base64").toString("utf-8");

        const parsedData = JSON.parse(decodedMessage);
        const historyId = parsedData.historyId;

        if (!historyId) {
            console.error("No historyId in Google notification");
            return NextResponse.json({ error: "Invalid Google notification" }, { status: 400 });
        }

        // Check for duplicate notifications
        const lastProcessed = processedMessages.get(historyId);
        const currentTimestamp = Date.now();
        if (lastProcessed && currentTimestamp - lastProcessed < DUPLICATE_WINDOW_MS) {
            console.log("Duplicate notification ignored");
            return NextResponse.json({ success: true });
        }

        // ✅ Get OAuth Token
        const accessToken = await getStoredToken();
        if (!accessToken) {
            console.error("No valid access token available");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ✅ Authenticate Gmail API
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: "v1", auth });

        // ✅ Fetch Gmail History Changes
        const history = await gmail.users.history.list({
            userId: "me",
            startHistoryId: String(historyId), // Ensure it's a string
        });

        // console.log("📨 Gmail History Changes:", history.data);

        // Process the first message change in the history (if any)
        if (history.data.history && history.data.history.length > 0) {
            const messageChange = history.data.history[0].messages?.[0];
            if (messageChange) {
                // ✅ Fetch Email Details
                const message = await gmail.users.messages.get({
                    userId: "me",
                    id: messageChange.id!,
                    format: "full",
                });
                // console.log(message);
                const headers = message.data.payload?.headers || [];
                const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
                const body = cleanEmailContent(message.data.snippet || "");

                console.log("📧 New Email:");
                console.log(`Subject: ${subject}`);
                console.log(`Body: ${body}`);

                // ✅ Fetch user folders (Gmail Labels)
                const labels = await gmail.users.labels.list({ userId: "me" });

                // ✅ Match folders for AI-based email categorization
                const folderDescriptions = await prisma.folderDescription.findMany();
                const availableFolders = folderDescriptions.filter((desc) =>
                    labels.data.labels?.some((l) => l.name?.toLowerCase() === desc.displayName.toLowerCase())
                );
console.log(availableFolders)
                const suggestedFolder = await analyzeFolderMatch({ subject, body }, availableFolders, false);

                console.log(`📂 Suggested Folder: ${suggestedFolder}`);

                // ✅ Move Email to Suggested Folder
                if (suggestedFolder) {
                    const targetLabel = labels.data.labels?.find(
                        (l) => l.name?.toLowerCase() === suggestedFolder.toLowerCase()
                    );

                    if (targetLabel) {
                        await gmail.users.messages.modify({
                            userId: "me",
                            id: messageChange.id!,
                            requestBody: { addLabelIds: [targetLabel.id!] },
                        });
                        console.log(`✅ Email moved to folder: ${suggestedFolder}`);
                    } else {
                        console.log(`⚠️ Folder "${suggestedFolder}" not found.`);
                    }
                }

                processedMessages.set(historyId, currentTimestamp);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("❌ Error processing pubsub notification:", error);
        return NextResponse.json({ error: "Failed to process notification" }, { status: 500 });
    }
}
