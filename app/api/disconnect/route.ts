import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/session';
import { deleteUser } from '@/lib/db';

export async function POST() {
  const userId = getSession();
  if (userId) {
    await deleteUser(userId);
  }
  clearSession();
  return NextResponse.json({ success: true });
}
