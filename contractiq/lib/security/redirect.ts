/**
 * Redirect-safety helpers.
 *
 * Deliberately free of server-only imports (no next/headers, no Supabase server
 * client) so Client Components can use it: `authGuard.ts` pulls in the
 * cookie-bound Supabase client and cannot be imported from the browser bundle.
 */

/** True if the string contains a C0 control, DEL, or C1 control character. */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return true
  }
  return false
}

/** A scheme prefix ("http:", "javascript:") after any number of leading slashes. */
const HAS_SCHEME = /^\/+[a-z][a-z0-9+.-]*:/i

/**
 * Same-origin redirect guard. Untrusted `?redirect=` values must never be handed
 * to `router.replace()` / `Location:` unchecked — an attacker who can get a user
 * to open `/login?redirect=https://evil.example` turns our own login page into a
 * credential-phishing hop, and the destination looks legitimate right up to the
 * moment the password is submitted.
 *
 * Accepts only a root-relative, non-protocol-relative path.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback

  // Validate the DECODED form too: "/%0d%0aSet-Cookie:x" is inert as a literal
  // string but becomes CRLF once a consumer decodes it, so a check against the
  // raw text alone can be bypassed by encoding the payload.
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // Malformed percent-encoding — reject rather than guess.
    return fallback
  }

  // Must be a root-relative path: "/dashboard", "/contracts/abc".
  if (!raw.startsWith('/')) return fallback
  // Reject protocol-relative ("//evil.com") and backslash variants ("/\evil.com"),
  // which browsers normalise to an absolute cross-origin URL.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  // Reject control characters (header/newline smuggling) and any scheme, in
  // both the raw and decoded forms.
  if (hasControlChars(raw) || hasControlChars(decoded)) return fallback
  if (HAS_SCHEME.test(raw) || HAS_SCHEME.test(decoded)) return fallback
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return fallback
  return raw
}
