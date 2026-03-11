import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getLikedListings, getDocuments } from '@/lib/db';

export async function GET() {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const listings = await getLikedListings(userId);
  const withDocs = await Promise.all(
    listings.map(async l => ({
      ...l,
      documents: await getDocuments(userId, l.id),
    }))
  );

  return NextResponse.json({ listings: withDocs });
}
