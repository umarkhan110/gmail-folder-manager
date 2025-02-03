import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export function cleanEmailContent(content: string) {
  if (!content) return '';

  // Create a DOM from the HTML content
  const dom = new JSDOM(content);
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  // Get the main content
  let cleaned = article?.textContent || content;

  // Clean up any remaining artifacts
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return cleaned;
}