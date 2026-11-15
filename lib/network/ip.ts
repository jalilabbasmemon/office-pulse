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
 * True when the deployment is the live production app.
 * NODE_ENV=production alone is not enough — OpenNext Workers always set it.
 */
export function isStrictProductionAppEnv(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "production";
}

/**
 * Runtime that uses production IP fail-closed policy (no XFF trust).
 * QA Workers use NEXT_PUBLIC_APP_ENV=qa so adapter testing remains possible.
 */
export function isProductionRuntime(): boolean {
  if (isStrictProductionAppEnv()) return true;
  if (process.env.NODE_ENV === "production") {
    const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
    // Explicit nonprod app envs on Workers (NODE_ENV still "production")
    if (appEnv === "qa" || appEnv === "staging" || appEnv === "preview") {
      return false;
    }
    return true;
  }
  return false;
}

/** Hosts that must never honor the E2E IP header (fail-closed). */
export function isDeniedProductionHost(
  appUrl = process.env.NEXT_PUBLIC_APP_URL
): boolean {
  // Production app env never allows hostname override (SEC-F-010).
  if (isStrictProductionAppEnv()) return true;
  if (!appUrl) return false;
  // Explicit opt-in for a preview that reuses a production-looking hostname.
  // Ignored when NEXT_PUBLIC_APP_ENV=production (above).
  if (process.env.E2E_NONPROD_HOST === "1") return false;
  try {
    const host = new URL(appUrl).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (
      host.includes("preview") ||
      host.includes("staging") ||
      host.includes("test") ||
      host.includes("-qa.") ||
      host.startsWith("office-pulse-qa.")
    ) {
      return false;
    }
    // Known production Worker hostname patterns for this product.
    if (host === "office-pulse.workers.dev") return true;
    if (host.startsWith("office-pulse.") && host.endsWith(".workers.dev")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Test-only trusted IP adapter for local / QA Worker E2E.
 * Never active when NEXT_PUBLIC_APP_ENV=production.
 * On Workers (NODE_ENV=production), requires explicit APP_ENV=qa|staging|preview.
 * Never overrides Cloudflare cf-connecting-ip.
 */
export function isE2eTrustedIpAdapterEnabled(): boolean {
  if (isStrictProductionAppEnv()) return false;
  if (process.env.E2E_TRUSTED_IP_ADAPTER !== "1") return false;
  if (isDeniedProductionHost()) return false;

  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
  if (appEnv === "qa" || appEnv === "staging" || appEnv === "preview") {
    return true;
  }
  // Local `next dev` only — bare NODE_ENV=production (live Worker) stays closed.
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Best-effort client public IP.
 * On Cloudflare, prefer cf-connecting-ip (true visitor IP) and NEVER let
 * client-supplied x-officepulse-e2e-ip override it.
 */
export function getRequestIp(request: NextRequest): string {
  // 1) Cloudflare visitor IP always wins — fail-closed against header spoofing.
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp);

  // 2) QA/local adapter (env-gated). Allowed on Workers only when APP_ENV=qa|staging|preview.
  if (isE2eTrustedIpAdapterEnabled()) {
    const e2eIp = request.headers.get("x-officepulse-e2e-ip");
    if (e2eIp?.trim()) return normalizeIp(e2eIp);
  }

  // 3) Strict production: do NOT trust client XFF / X-Real-IP (SEC-F-005).
  if (isProductionRuntime()) {
    return "0.0.0.0";
  }

  // 4) Local/dev without adapter: best-effort proxy headers.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return normalizeIp(realIp);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
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

/** Collect IPs from every active branch + optional org-level fallback. */
export function collectOfficeIpsFromLocations(
  locations: { is_active?: boolean; allowed_public_ips?: string[] | null }[],
  officePublicIp?: string | null,
  orgAllowedIps?: string[] | null
): string[] {
  const allowed = new Set<string>(
    getAllowedOfficeIps(officePublicIp, orgAllowedIps)
  );
  for (const loc of locations) {
    if (loc.is_active === false) continue;
    for (const ip of loc.allowed_public_ips ?? []) {
      const n = normalizeIp(ip);
      if (n) allowed.add(n);
    }
  }
  return Array.from(allowed);
}

/**
 * Find the active location that owns this public IP.
 * First matching location by sort order wins.
 */
export function matchLocationByPublicIp<
  T extends {
    id: string;
    name: string;
    is_active?: boolean;
    allowed_public_ips?: string[] | null;
  },
>(requestIp: string, locations: T[]): T | null {
  const ip = normalizeIp(requestIp);
  if (!ip) return null;
  for (const loc of locations) {
    if (loc.is_active === false) continue;
    const ips = (loc.allowed_public_ips ?? [])
      .map((v) => normalizeIp(v))
      .filter(Boolean);
    if (ips.includes(ip)) return loc;
  }
  return null;
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
