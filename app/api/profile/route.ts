import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getProfile, upsertProfile } from '@/lib/db';

export async function GET() {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await getProfile(userId);
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const profile = await upsertProfile(userId, body);
  return NextResponse.json({ profile });
}
