import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredToken } from '@/lib/tokenStore';
import { Client } from '@microsoft/microsoft-graph-client';
import { analyzeFolderMatch } from '@/lib/openai-service';
import { cleanEmailContent } from '@/lib/emailParser';
import { google } from 'googleapis';

// Keep track of recently processed message IDs
const processedMessages = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 60000; // 1 minute window

function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Replace multiple spaces/newlines with single space
  text = text.replace(/\s+/g, ' ');
  // Trim whitespace
  return text.trim();
}

export async function POST(request: Request) {
  console.log('\n=== Incoming Notification Request ===');

  if (request.headers.get('X-Goog-Resource-State') === 'sync') {
    console.log('Google Pub/Sub Verification Request');
    return new Response('OK', { status: 200 });
  }
  // Validation token handling
  const validationToken = new URL(request.url).searchParams.get('validationToken');
  if (validationToken) {
    console.log('Received validation request:', validationToken);
    return new Response(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  try {
    const body = await request.json();
    const token = await getStoredToken();
    if (!token) {
      console.error('No valid access token available');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (request.headers.has('X-Goog-Resource-ID')) {
      console.log('Google Notification Received:', body);

      const historyId = body.historyId;
      if (!historyId) {
        console.error('No historyId in Google notification');
        return NextResponse.json({ error: 'Invalid Google notification' }, { status: 400 });
      }

      // Fetch recent changes from Gmail API
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });

      const gmail = google.gmail({ version: 'v1', auth });
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
      });


      if (!history.data.history) {
        console.log("No new messages found.");
        return NextResponse.json({ success: true });
      }
      console.log('Google Email Changes:', history.data);
      for (const record of history.data.history) {
        if (!record.messages) continue;

        for (const msg of record.messages) {
          if (processedMessages.has(msg.id!)) {
            console.log(`Skipping duplicate Google message: ${msg.id}`);
            continue;
          }
          processedMessages.set(msg.id!, Date.now());
          const message = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "full",
          });

          const headers = message.data.payload?.headers || [];
          const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
          const body = cleanEmailContent(message.data.snippet || "");

          console.log("New Email Received:");
          console.log(`Subject: ${subject}`);
          console.log(`Body: ${body}`);

          // Get user folders
          const labels = await gmail.users.labels.list({ userId: "me" });

          const folderDescriptions = await prisma.folderDescription.findMany();
          const availableFolders = folderDescriptions.filter((desc) =>
            labels.data.labels?.some((l) => l.name?.toLowerCase() === desc.displayName.toLowerCase())
          );

          const suggestedFolder = await analyzeFolderMatch(
            { subject, body },
            availableFolders,
            false
          );

          console.log(`Suggested folder: ${suggestedFolder}`);

          if (suggestedFolder) {
            const targetLabel = labels.data.labels?.find(
              (l) => l.name?.toLowerCase() === suggestedFolder.toLowerCase()
            );

            if (targetLabel) {
              await gmail.users.messages.modify({
                userId: "me",
                id: msg.id!,
                requestBody: { addLabelIds: [targetLabel.id!] },
              });
              console.log(`Moved email to folder: ${suggestedFolder}`);
            } else {
              console.log(`Folder "${suggestedFolder}" not found.`);
            }
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });

    // Check for duplicate notifications
    for (const notification of body.value) {
      const messageId = notification.resourceData?.id;
      if (!messageId) continue;

      const lastProcessed = processedMessages.get(messageId);
      const now = Date.now();

      if (lastProcessed && (now - lastProcessed) < DUPLICATE_WINDOW_MS) {
        console.log(`Skipping duplicate message: ${messageId}`);
        continue;
      }

      processedMessages.set(messageId, now);

      // Clean up old entries periodically
      if (processedMessages.size > 1000) {  // Prevent memory leaks
        for (const [id, timestamp] of processedMessages.entries()) {
          if (now - timestamp > DUPLICATE_WINDOW_MS) {
            processedMessages.delete(id);
          }
        }
      }

      try {
        // Get the message details
        const message = await client.api(`/me/messages/${notification.resourceData.id}`)
          .select('subject,body,parentFolderId')
          .get();

        // Get the parent folder details
        const parentFolder = await client.api(`/me/mailFolders/${message.parentFolderId}`)
          .select('displayName')
          .get();

        console.log('Parent folder:', parentFolder.displayName);

        // Skip if not in inbox
        if (parentFolder.displayName.toLowerCase() !== 'inbox') {
          console.log(`Skipping - not in inbox (folder: ${parentFolder.displayName})`);
          continue;
        }

        const emailContent = {
          subject: message.subject,
          body: cleanEmailContent(message.body.content)
        };

        console.log('\n=== New Email Received ===');
        console.log(`Subject: ${emailContent.subject}`);
        console.log(`Body: ${emailContent.body}`);

        const userFolders = await client.api('/me/mailFolders')
          .select('id,displayName')
          .get();

        const folderDescriptions = await prisma.folderDescription.findMany();

        // Only include folders that exist in the user's mailbox
        const availableFolders = folderDescriptions.filter(desc =>
          userFolders.value.some((f: any) =>
            f.displayName.toLowerCase() === desc.displayName.toLowerCase()
          )
        );

        const suggestedFolder = await analyzeFolderMatch(
          emailContent,
          availableFolders,
          false
        );

        console.log(`Suggested folder: ${suggestedFolder}`);

        if (suggestedFolder) {
          // Get all folders and find the target folder
          const folders = await client.api('/me/mailFolders')
            .select('id,displayName')
            .get();

          const targetFolder = folders.value.find(
            (f: any) => f.displayName.toLowerCase() === suggestedFolder.toLowerCase()
          );

          if (targetFolder) {
            try {
              await client.api(`/me/messages/${notification.resourceData.id}/move`)
                .post({
                  destinationId: targetFolder.id
                });
              console.log(`Moved email to folder: ${suggestedFolder}`);
            } catch (error) {
              console.error('Error moving email:', error);
            }
          } else {
            console.log(`Folder "${suggestedFolder}" not found in user's mailbox`);
          }
        }

        console.log('========================\n');
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing notification:', error);
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 });
  }
}
