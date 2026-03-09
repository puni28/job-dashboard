import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/gmail';
import { upsertUser } from '@/lib/db';
import { setSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=access_denied`);
  }

  try {
    const { email, accessToken, refreshToken, expiry } = await exchangeCodeForTokens(code);
    const user = upsertUser(email, accessToken, refreshToken, expiry);
    setSession(user.id);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?connected=true`);
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=token_failed`);
  }
}
