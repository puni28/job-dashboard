import Anthropic from '@anthropic-ai/sdk';
import { GmailMessage } from './gmail';
import { EmailClassification, classifyEmail } from './emailParser';

const client = new Anthropic();

// Batch classify emails using Claude AI — falls back to regex on failure
export async function classifyEmailsBatch(
  emails: GmailMessage[]
): Promise<EmailClassification[]> {
  if (emails.length === 0) return [];

  const emailList = emails
    .map((email, i) => {
      const snippet = (email.snippet || '').slice(0, 300);
      return `[${i}] From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${snippet}`;
    })
    .join('\n---\n');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system: `You are an expert classifier for job application emails.

For each email, determine:
- isJobRelated (boolean): true only if the email is part of a job application process
- emailType (string): one of exactly these values:
  * "application" — application confirmation or receipt
  * "screening" — recruiter reaching out or phone screen
  * "interview" — interview invitation or scheduling
  * "offer" — job offer extended
  * "rejected" — rejection notice
  * "update" — other job-related update
- company (string): company name extracted from the email (or "Unknown Company")
- position (string): job title extracted from the email (or "Position")
- confidence (number): integer 0–100 reflecting classification certainty

Return ONLY a valid JSON array (no markdown, no extra text) containing exactly one object per email, in the same order as provided. Example format:
[{"isJobRelated":true,"emailType":"application","company":"Acme Corp","position":"Software Engineer","confidence":90}]`,
      messages: [
        {
          role: 'user',
          content: `Classify these ${emails.length} emails and return a JSON array with ${emails.length} objects:\n\n${emailList}`,
        },
      ],
    });

    const finalMessage = await stream.finalMessage();

    const textBlock = finalMessage.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text block in Claude response');
    }

    // Extract JSON array from the response (handles any surrounding whitespace/text)
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in Claude response');

    const parsed = JSON.parse(jsonMatch[0]) as EmailClassification[];

    if (!Array.isArray(parsed) || parsed.length !== emails.length) {
      throw new Error(
        `Expected ${emails.length} classifications, got ${parsed?.length}`
      );
    }

    return parsed;
  } catch (error) {
    console.error('[Claude Classifier] Failed, falling back to regex:', error);
    return emails.map((email) => classifyEmail(email));
  }
}
