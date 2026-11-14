/**
 * SEC-F-002 — Allow only same-app relative paths for post-auth redirects.
 * Rejects absolute URLs, protocol-relative, backslash tricks, encoded variants,
 * control characters, and unexpected schemes.
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (next == null) return fallback;

  let value = String(next);
  // Decode once to catch %2f%2fevil and similar; reject if still unsafe.
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  value = value.trim();
  if (!value) return fallback;

  // Control characters / CR LF injection
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  // Must be a relative path on this origin
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.includes("://")) return fallback;

  // Block scheme-like prefixes after slash (e.g. /javascript:...)
  const afterSlash = value.slice(1);
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(afterSlash)) return fallback;

  // Normalize accidental double-slash mid-path for open-redirect variants
  if (value.startsWith("/\\") || value.startsWith("/ /")) return fallback;

  return value;
}
