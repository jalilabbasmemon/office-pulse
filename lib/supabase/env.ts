export type PublicSupabaseEnv = {
  url: string;
  publishableKey: string;
};

declare global {
  interface Window {
    __OFFICE_PULSE_ENV__?: PublicSupabaseEnv;
  }
}

function readPublicEnv(): PublicSupabaseEnv {
  // 1) Runtime injection from Worker (Cloudflare vars available on server → layout)
  if (typeof window !== "undefined" && window.__OFFICE_PULSE_ENV__?.url) {
    return window.__OFFICE_PULSE_ENV__;
  }

  // 2) Build-time / Node process env (local next dev + OpenNext server)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  return { url, publishableKey };
}

/** Public browser-safe project URL. */
export function getSupabaseUrl() {
  const { url } = readPublicEnv();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Set it in Cloudflare Build + Runtime variables."
    );
  }
  return url;
}

export function getSupabasePublishableKey() {
  const { publishableKey } = readPublicEnv();
  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Set it in Cloudflare Build + Runtime variables."
    );
  }
  return publishableKey;
}

/**
 * Server-only privileged key.
 * Prefer new Secret key (`sb_secret_...`); legacy `service_role` JWT also works.
 */
export function getSupabaseSecretKey() {
  let key = (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  // Guard against users pasting "NAME=value" into the secret field
  if (key.startsWith("SUPABASE_SECRET_KEY=")) {
    key = key.slice("SUPABASE_SECRET_KEY=".length).trim();
  }
  if (key.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    key = key.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
  }
  // Strip accidental quotes from dashboard paste
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

/** Values safe to expose to the browser (injected by root layout). */
export function getPublicSupabaseEnvForClient(): PublicSupabaseEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "",
  };
}
