import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from '@/lib/session';
import { upsertJobListing, getUserListingActions, getProfile } from '@/lib/db';
import { scoreListings } from '@/lib/matcher';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Oracle Cloud HCM Candidate Experience URLs are SPAs; use their REST API instead.
function parseOracleHCMUrl(parsedUrl: URL): { siteNumber: string; jobId: string } | null {
  const m = parsedUrl.pathname.match(
    /\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+)\/jobs\/(?:preview\/)?(\d+)/
  );
  if (!m) return null;
  return { siteNumber: m[1], jobId: m[2] };
}

async function fetchOracleHCMPageText(parsedUrl: URL, siteNumber: string, jobId: string): Promise<string | null> {
  const apiUrl =
    `${parsedUrl.origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
    `?expand=all&onlyData=true&finder=findReqs;siteNumber=${siteNumber},requisitionNumber=${jobId}`;

  const res = await fetch(apiUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobDashboard/1.0)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const item = data?.items?.[0];
  if (!item) return null;

  // Flatten relevant fields into plain text for Claude to parse
  const parts: string[] = [];
  if (item.Title) parts.push(`Job Title: ${item.Title}`);
  if (item.PrimaryLocation) parts.push(`Location: ${item.PrimaryLocation}`);
  if (item.PostedOrganization) parts.push(`Company: ${item.PostedOrganization}`);
  if (item.SalaryLow || item.SalaryHigh) {
    parts.push(`Salary: ${item.SalaryLow ?? ''}${item.SalaryHigh ? ` - ${item.SalaryHigh}` : ''} ${item.Currency ?? ''}`.trim());
  }
  const desc: string = item.ExternalDescriptionStr ?? item.ShortDescriptionStr ?? item.ExternalDescription ?? '';
  if (desc) parts.push(`Description: ${htmlToText(desc)}`);
  if (item.Skills) parts.push(`Skills: ${item.Skills}`);
  if (item.WorkplaceType) parts.push(`Workplace: ${item.WorkplaceType}`);

  return parts.join('\n');
}

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

  // Fetch page content — use platform-specific APIs for SPAs where available
  let pageText: string;
  try {
    const oracleParams = parseOracleHCMUrl(parsedUrl);
    if (oracleParams) {
      const oracleText = await fetchOracleHCMPageText(parsedUrl, oracleParams.siteNumber, oracleParams.jobId);
      if (oracleText && oracleText.length > 50) {
        pageText = oracleText;
      } else {
        return NextResponse.json({ error: 'Could not retrieve job details from Oracle HCM API. The job may no longer be active.' }, { status: 422 });
      }
    } else {
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
    }
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
