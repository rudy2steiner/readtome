/**
 * Auth stays off until Google credentials exist. A half-configured provider renders a sign-in
 * button that always fails, so the shell hides every account entry point instead.
 */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);
}
