const FALLBACK_PATH = '/dashboard';

export function safeRedirectPath(candidate: string | null, origin: string): string {
  if (
    !candidate
    || !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return FALLBACK_PATH;
  }

  try {
    const trustedOrigin = new URL(origin).origin;
    const destination = new URL(candidate, trustedOrigin);
    if (destination.origin !== trustedOrigin) return FALLBACK_PATH;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return FALLBACK_PATH;
  }
}
