import { NextRequest } from "next/server";

export function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "0.0.0.0";
}

export function isOfficeNetwork(
  requestIp: string,
  officePublicIp: string | null | undefined,
  allowedIps: string[] | null | undefined
): boolean {
  const allowed = new Set<string>();

  if (officePublicIp?.trim()) {
    allowed.add(officePublicIp.trim());
  }

  for (const ip of allowedIps ?? []) {
    if (ip?.trim()) allowed.add(ip.trim());
  }

  // If no office IP is configured yet, skip network check (admin must set it).
  if (allowed.size === 0) return true;

  return allowed.has(requestIp);
}
