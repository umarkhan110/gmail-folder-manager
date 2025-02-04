import OpenAI from 'openai';
import { cleanEmailContent } from './emailParser';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EmailContent {
  subject: string;
  body: string;
}

interface Folder {
  displayName: string;
  description: string;
}

// List of system folders to ignore
const SYSTEM_FOLDERS = [
  'archive',
  'conversation history',
  'deleted items',
  'drafts',
  'inbox',
  'junk email',
  'outbox',
  'sent items',
].map(name => name.toLowerCase());

export async function analyzeFolderMatch(
  email: EmailContent, 
  folders: Folder[], 
  showSystemFolders: boolean
) {
  // Clean the email body before processing
  const cleanedBody = cleanEmailContent(email.body);
  
  // Filter folders based on the showSystemFolders setting
  const availableFolders = showSystemFolders 
    ? folders 
    : folders.filter((folder:any) => folder.type !== 'system');
console.log("availableFolders", availableFolders)
  // If no folders available, return null
  if (availableFolders.length === 0) {
    return null;
  }

  const folderDescriptions = availableFolders
    .map(folder => `- ${folder.displayName}: ${folder.description || 'No description'}`)
    .join('\n');

  const prompt = `Given the following email and available folders, determine which folder would be the most appropriate for this email. Respond only with the folder name that best matches.

Available folders:
${folderDescriptions}

Email:
Subject: ${email.subject}
Body: ${cleanedBody}

Best matching folder:`;
// console.log(prompt)
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that analyzes emails and determines the best folder for them based on folder descriptions. Respond only with the exact folder name that best matches."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    model: "gpt-3.5-turbo",
    temperature: 0.3,
    max_tokens: 60,
  });

  return completion.choices[0].message.content?.trim();
}
