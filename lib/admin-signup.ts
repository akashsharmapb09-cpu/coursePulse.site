import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SIGNUP_COOKIE = 'coursepulse_admin_signup';
export type AdminSignupMethod = 'email' | 'phone' | 'google';

type AdminSignupProof = {
  version: 1;
  method: AdminSignupMethod;
  identity?: string;
  expiresAt: number;
};

function signingSecret() {
  const secret = process.env.ADMIN_SIGNUP_CODE;
  if (!secret) throw new Error('ADMIN_SIGNUP_CODE is not configured.');
  return secret;
}

function safeCompare(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidAdminSignupCode(candidate: string) {
  const expected = process.env.ADMIN_SIGNUP_CODE;
  return Boolean(expected && safeCompare(candidate, expected));
}

export function createAdminSignupProof(method: AdminSignupMethod, identity?: string) {
  const proof: AdminSignupProof = {
    version: 1,
    method,
    ...(identity ? { identity } : {}),
    expiresAt: Date.now() + 2 * 60 * 60 * 1000
  };
  const payload = Buffer.from(JSON.stringify(proof)).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return payload + '.' + signature;
}

export function verifyAdminSignupProof(value: string): AdminSignupProof | null {
  try {
    const [payload, signature] = value.split('.');
    if (!payload || !signature || !safeCompare(
      createHmac('sha256', signingSecret()).update(payload).digest('base64url'),
      signature
    )) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSignupProof;
    if (parsed.version !== 1 || !['email', 'phone', 'google'].includes(parsed.method) ||
      !Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now()) return null;
    if (parsed.method === 'email' && typeof parsed.identity !== 'string') return null;
    if (parsed.method === 'phone' && typeof parsed.identity !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
