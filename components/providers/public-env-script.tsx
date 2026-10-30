import { getPublicSupabaseEnvForClient } from "@/lib/supabase/env";

/** Injects public Supabase config for the browser (works with Cloudflare runtime vars). */
export function PublicEnvScript() {
  const env = getPublicSupabaseEnvForClient();
  const payload = JSON.stringify(env).replace(/</g, "\\u003c");

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__OFFICE_PULSE_ENV__=${payload};`,
      }}
    />
  );
}
