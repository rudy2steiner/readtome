import { getToken } from 'next-auth/jwt';
import type { Session } from 'next-auth';

/**
 * OpenNext route handlers do not populate `next/headers`, so `await auth()` is
 * empty even when `/api/auth/session` (which reads the Request) is signed in.
 * Decode the session cookie off the incoming request instead.
 */
export async function sessionFromRequest(req: Request): Promise<Session | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const secure = new URL(req.url).protocol === 'https:';
  const token =
    (await getToken({ req, secret, secureCookie: secure })) ??
    (await getToken({ req, secret, secureCookie: !secure }));
  if (!token) return null;

  const stored = token.user;
  return {
    user: {
      uuid: stored?.uuid,
      email: stored?.email ?? token.email,
      name: stored?.name ?? token.name,
      image: stored?.image ?? (typeof token.picture === 'string' ? token.picture : null),
    },
    expires: typeof token.exp === 'number' ? new Date(token.exp * 1000).toISOString() : new Date(0).toISOString(),
  };
}
