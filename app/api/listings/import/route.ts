import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from '@/lib/session';
import { upsertJobListing, getUserListingActions, getProfile } from '@/lib/db';
import { scoreListings } from '@/lib/matcher';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Fetch the page
  let pageText: string;
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobDashboard/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch the page (HTTP ${res.status}). Some job boards block automated access.` }, { status: 422 });
    }
    const html = await res.text();
    pageText = htmlToText(html);
    // Trim to ~12k chars to keep Claude prompt reasonable
    if (pageText.length > 12000) pageText = pageText.slice(0, 12000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return NextResponse.json({ error: `Failed to fetch URL: ${msg}` }, { status: 422 });
  }

  // Use Claude to extract job details
  const extractionPrompt = `Extract job posting details from the text below and return ONLY a valid JSON object with these fields (use null for anything not found):

{
  "title": string,
  "company": string,
  "location": string | null,
  "remote": "remote" | "hybrid" | "onsite" | null,
  "salary": string | null,
  "description": string,
  "tags": string | null
}

Rules:
- "title": the job title/role name
- "company": employer name
- "location": city/region or "Remote"
- "remote": infer from location and description
- "salary": any compensation range mentioned (e.g. "$120k - $160k")
- "description": a clean 3-6 sentence summary of the role and requirements (no HTML)
- "tags": comma-separated key skills/technologies mentioned (max 10)

PAGE TEXT:
${pageText}

Respond with ONLY the JSON object, no other text.`;

  let extracted: {
    title: string;
    company: string;
    location: string | null;
    remote: string | null;
    salary: string | null;
    description: string;
    tags: string | null;
  };

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: extractionPrompt }],
    });
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    extracted = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: 'Could not extract job details from the page. Try a different URL or paste the job description manually.' }, { status: 422 });
  }

  if (!extracted.title || !extracted.company) {
    return NextResponse.json({ error: 'Could not identify a job posting on this page.' }, { status: 422 });
  }

  // Stable external_id based on URL
  const externalId = `imported:${parsedUrl.hostname}${parsedUrl.pathname}`;

  const listingId = await upsertJobListing({
    external_id: externalId,
    source: 'Imported',
    title: extracted.title,
    company: extracted.company,
    location: extracted.location ?? null,
    remote: extracted.remote ?? null,
    salary: extracted.salary ?? null,
    description: extracted.description,
    tags: extracted.tags ?? null,
    url: parsedUrl.toString(),
    posted_at: null,
  });

  // Score against user profile
  const [profile, actions] = await Promise.all([
    getProfile(userId),
    getUserListingActions(userId),
  ]);

  const rawListing = {
    id: listingId,
    external_id: externalId,
    source: 'Imported' as const,
    title: extracted.title,
    company: extracted.company,
    location: extracted.location ?? null,
    remote: extracted.remote ?? null,
    salary: extracted.salary ?? null,
    description: extracted.description,
    tags: extracted.tags ?? null,
    url: parsedUrl.toString(),
    posted_at: null,
    fetched_at: new Date().toISOString(),
  };

  const scored = profile
    ? scoreListings([rawListing], profile)[0]
    : { ...rawListing, score: 50, matchedSkills: [] as string[] };

  const actionMap = new Map(actions.map(a => [a.listing_id, a.action]));

  return NextResponse.json({
    listing: {
      ...scored,
      userAction: actionMap.get(listingId) ?? null,
    },
  });
}
