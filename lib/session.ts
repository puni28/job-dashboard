import { cookies } from 'next/headers';

const SESSION_COOKIE = 'jd_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-me';

export function setSession(userId: number) {
  const value = Buffer.from(`${userId}:${SESSION_SECRET}`).toString('base64');
  cookies().set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export function getSession(): number | null {
  try {
    const cookie = cookies().get(SESSION_COOKIE);
    if (!cookie) return null;
    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    const [userId, secret] = decoded.split(':');
    if (secret !== SESSION_SECRET) return null;
    const id = parseInt(userId, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}
