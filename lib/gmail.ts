import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getUserById, updateUserTokens } from './db';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'];

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback`
  );
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();

  return {
    email: userInfo.data.email as string,
    accessToken: tokens.access_token as string,
    refreshToken: tokens.refresh_token as string,
    expiry: tokens.expiry_date as number,
  };
}

export async function getAuthenticatedClient(userId: number): Promise<OAuth2Client | null> {
  const user = await getUserById(userId);
  if (!user || !user.access_token) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: user.token_expiry,
  });

  // Auto-refresh if expired
  client.on('tokens', (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      updateUserTokens(userId, tokens.access_token, tokens.expiry_date);
    }
  });

  try {
    await client.getAccessToken();
  } catch {
    return null;
  }

  return client;
}

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
};

export async function fetchJobEmails(userId: number, maxResults = 100): Promise<GmailMessage[]> {
  const client = await getAuthenticatedClient(userId);
  if (!client) return [];

  const gmail = google.gmail({ version: 'v1', auth: client });

  // Search query for job-related emails
  const query = [
    'subject:(application OR applied OR "thank you for applying" OR "we received your application" OR interview OR "job offer" OR offer OR rejected OR "not selected" OR "moving forward")',
    'newer_than:90d',
  ].join(' ');

  let allMessages: GmailMessage[] = [];
  let pageToken: string | undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults - allMessages.length, 50),
      pageToken,
    });

    const messages = listRes.data.messages || [];
    pageToken = listRes.data.nextPageToken || undefined;

    const fetched = await Promise.all(
      messages.map(m => fetchMessage(gmail, m.id!))
    );

    allMessages = [...allMessages, ...fetched.filter(Boolean) as GmailMessage[]];
  } while (pageToken && allMessages.length < maxResults);

  return allMessages;
}

async function fetchMessage(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const date = getHeader('Date');

    const body = extractBody(msg.data.payload);

    return {
      id: messageId,
      threadId: msg.data.threadId || '',
      subject,
      from,
      date,
      snippet: msg.data.snippet || '',
      body,
    };
  } catch {
    return null;
  }
}

function extractBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;

  if (p.body && typeof p.body === 'object') {
    const body = p.body as Record<string, unknown>;
    if (body.data && typeof body.data === 'string') {
      return Buffer.from(body.data, 'base64').toString('utf-8');
    }
  }

  if (Array.isArray(p.parts)) {
    for (const part of p.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return '';
}
