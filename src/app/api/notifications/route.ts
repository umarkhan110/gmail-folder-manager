import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStoredToken } from '@/lib/tokenStore';
import { Client } from '@microsoft/microsoft-graph-client';
import { analyzeFolderMatch } from '@/lib/openai-service';
import { cleanEmailContent } from '@/lib/emailParser';

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
    console.log(body)
    // const token = await getStoredToken();
    // if (!token) {
    //   console.error('No valid access token available');
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // const client = Client.init({
    //   authProvider: (done) => {
    //     done(null, token);
    //   },
    // });

    // // Check for duplicate notifications
    // for (const notification of body.value) {
    //   const messageId = notification.resourceData?.id;
    //   if (!messageId) continue;

    //   const lastProcessed = processedMessages.get(messageId);
    //   const now = Date.now();

    //   if (lastProcessed && (now - lastProcessed) < DUPLICATE_WINDOW_MS) {
    //     console.log(`Skipping duplicate message: ${messageId}`);
    //     continue;
    //   }

    //   processedMessages.set(messageId, now);

    //   // Clean up old entries periodically
    //   if (processedMessages.size > 1000) {  // Prevent memory leaks
    //     for (const [id, timestamp] of processedMessages.entries()) {
    //       if (now - timestamp > DUPLICATE_WINDOW_MS) {
    //         processedMessages.delete(id);
    //       }
    //     }
    //   }

    //   try {
    //     // Get the message details
    //     const message = await client.api(`/me/messages/${notification.resourceData.id}`)
    //       .select('subject,body,parentFolderId')
    //       .get();

    //     // Get the parent folder details
    //     const parentFolder = await client.api(`/me/mailFolders/${message.parentFolderId}`)
    //       .select('displayName')
    //       .get();

    //     console.log('Parent folder:', parentFolder.displayName);
        
    //     // Skip if not in inbox
    //     if (parentFolder.displayName.toLowerCase() !== 'inbox') {
    //       console.log(`Skipping - not in inbox (folder: ${parentFolder.displayName})`);
    //       continue;
    //     }

    //     const emailContent = {
    //       subject: message.subject,
    //       body: cleanEmailContent(message.body.content)
    //     };

    //     console.log('\n=== New Email Received ===');
    //     console.log(`Subject: ${emailContent.subject}`);
    //     console.log(`Body: ${emailContent.body}`);

    //     const userFolders = await client.api('/me/mailFolders')
    //       .select('id,displayName')
    //       .get();

    //     const folderDescriptions = await prisma.folderDescription.findMany();

    //     // Only include folders that exist in the user's mailbox
    //     const availableFolders = folderDescriptions.filter(desc => 
    //       userFolders.value.some((f: any) => 
    //         f.displayName.toLowerCase() === desc.displayName.toLowerCase()
    //       )
    //     );

    //     const suggestedFolder = await analyzeFolderMatch(
    //       emailContent,
    //       availableFolders,
    //       false
    //     );

    //     console.log(`Suggested folder: ${suggestedFolder}`);

    //     if (suggestedFolder) {
    //       // Get all folders and find the target folder
    //       const folders = await client.api('/me/mailFolders')
    //         .select('id,displayName')
    //         .get();
          
    //       const targetFolder = folders.value.find(
    //         (f: any) => f.displayName.toLowerCase() === suggestedFolder.toLowerCase()
    //       );

    //       if (targetFolder) {
    //         try {
    //           await client.api(`/me/messages/${notification.resourceData.id}/move`)
    //             .post({
    //               destinationId: targetFolder.id
    //             });
    //           console.log(`Moved email to folder: ${suggestedFolder}`);
    //         } catch (error) {
    //           console.error('Error moving email:', error);
    //         }
    //       } else {
    //         console.log(`Folder "${suggestedFolder}" not found in user's mailbox`);
    //       }
    //     }

    //     console.log('========================\n');
    //   } catch (error) {
    //     console.error('Error processing email:', error);
    //   }
    // }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing notification:', error);
    return NextResponse.json({ error: 'Failed to process notification' }, { status: 500 });
  }
}
