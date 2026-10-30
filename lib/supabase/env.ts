/** Public browser-safe key (new publishable key or legacy anon key). */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }
  return key;
}

/**
 * Server-only privileged key.
 * Prefer new Secret key (`sb_secret_...`); legacy `service_role` JWT also works.
 */
export function getSupabaseSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return key;
}
