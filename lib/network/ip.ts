import { NextRequest } from "next/server";

/** Normalize IPv4/IPv6 so comparisons are stable. */
export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "";
  let value = ip.trim().toLowerCase();

  // Strip surrounding brackets used for IPv6 literals
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }

  // IPv4-mapped IPv6 → IPv4
  if (value.startsWith("::ffff:")) {
    value = value.slice("::ffff:".length);
  }

  // Remove zone id if present (fe80::1%eth0)
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);

  return value;
}

/**
 * Best-effort client public IP.
 * On Cloudflare, prefer cf-connecting-ip (true visitor IP).
 */
export function getRequestIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return normalizeIp(realIp);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Left-most is usually the original client
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  return "0.0.0.0";
}

export function getAllowedOfficeIps(
  officePublicIp: string | null | undefined,
  allowedIps: string[] | null | undefined
): string[] {
  const allowed = new Set<string>();
  if (officePublicIp?.trim()) allowed.add(normalizeIp(officePublicIp));
  for (const ip of allowedIps ?? []) {
    const n = normalizeIp(ip);
    if (n) allowed.add(n);
  }
  return Array.from(allowed);
}

export function isOfficeNetwork(
  requestIp: string,
  officePublicIp: string | null | undefined,
  allowedIps: string[] | null | undefined
): boolean {
  const allowed = getAllowedOfficeIps(officePublicIp, allowedIps);
  // No office IP configured → network check cannot run (treat as fail for punch safety)
  if (allowed.length === 0) return false;
  return allowed.includes(normalizeIp(requestIp));
}

export function hasOfficeIpConfigured(
  officePublicIp: string | null | undefined,
  allowedIps: string[] | null | undefined
): boolean {
  return getAllowedOfficeIps(officePublicIp, allowedIps).length > 0;
}
