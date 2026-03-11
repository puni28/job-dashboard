import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getJobListings, getUserListingActions, getProfile } from '@/lib/db';
import { scoreListings } from '@/lib/matcher';

export async function GET() {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [listings, actions, profile] = await Promise.all([
    getJobListings(300),
    getUserListingActions(userId),
    getProfile(userId),
  ]);

  const actionMap = new Map(actions.map(a => [a.listing_id, a.action]));

  // Score against profile if available
  const scored = profile ? scoreListings(listings, profile) : listings.map(l => ({ ...l, score: 50, matchedSkills: [] as string[] }));

  const result = scored.map(l => ({
    ...l,
    userAction: actionMap.get(l.id) ?? null,
  }));

  // Sort: unactioned first (by score desc), then actioned
  result.sort((a, b) => {
    const aActioned = !!a.userAction;
    const bActioned = !!b.userAction;
    if (aActioned !== bActioned) return aActioned ? 1 : -1;
    return b.score - a.score;
  });

  return NextResponse.json({ listings: result });
}
