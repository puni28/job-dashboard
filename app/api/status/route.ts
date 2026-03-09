import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/db';

export async function GET() {
  const userId = getSession();
  if (!userId) {
    return NextResponse.json({ connected: false });
  }

  const user = await getUserById(userId);
  if (!user || !user.access_token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({ connected: true, email: user.email });
}
