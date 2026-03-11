import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile, upsertJobListing } from '@/lib/db';
import { fetchAllSources } from '@/lib/jobFetchers';

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const customSearch: string[] = body.search || [];

  const profile = await getProfile(userId);
  const searchTerms = customSearch.length > 0
    ? customSearch
    : profile?.preferred_titles
      ? profile.preferred_titles.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

  const listings = await fetchAllSources(searchTerms.length > 0 ? searchTerms : undefined);

  let saved = 0;
  for (const listing of listings) {
    if (!listing.url || !listing.title) continue;
    await upsertJobListing(listing);
    saved++;
  }

  return NextResponse.json({ fetched: listings.length, saved, sources: ['Remotive', 'RemoteOK', 'The Muse', 'We Work Remotely'] });
}
