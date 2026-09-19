/** Comma / space / semicolon separated. Compared case-insensitively. */
export function adminEmailsFromEnv(raw = process.env.ADMIN_EMAILS): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes('@'));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailsFromEnv().includes(email.trim().toLowerCase());
}
