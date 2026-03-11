import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { setListingAction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { listingId, action } = await req.json();
  if (!listingId || !['liked', 'dismissed'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await setListingAction(userId, listingId, action);
  return NextResponse.json({ ok: true });
}
