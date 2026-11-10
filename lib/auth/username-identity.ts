// Internal Supabase Auth identity for accounts that do not collect an email address.
// The .invalid TLD is reserved and cannot receive email. Keep this mapping server-side only.
export const INTERNAL_AUTH_EMAIL_DOMAIN = 'accounts.coursepulse.invalid';

export function usernameToAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}
