import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.redirect('/?error=auth_failed');
  }
}
