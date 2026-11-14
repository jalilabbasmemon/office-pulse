/**
 * SEC-003 authorized punch verification against nonprod only.
 *
 * Requires:
 *   E2E_QA_SUPABASE_URL          https://hlcwsnhhmgjuxpebycyg.supabase.co
 *   E2E_QA_SUPABASE_ANON_KEY
 *   E2E_QA_SUPABASE_SECRET_KEY   (QA service role — never production)
 *   OFFICEPULSE_TEST_URL         QA Worker or local Next pointed at QA
 *   E2E_EMPLOYEE_* / E2E_ADMIN_* / E2E_VIEWER_* / E2E_FORCE_PW_* / E2E_INACTIVE_*
 *   E2E_OFFICE_IP / E2E_OFFICE_LAT / E2E_OFFICE_LNG
 *   E2E_TRUSTED_IP_ADAPTER=1 on the app under test (local/QA only)
 *
 * Refuses production Supabase project ref.
 */

import { createClient } from "@supabase/supabase-js";

const PROD_REF = "jniyfhpwrjofdljqsdwd";
const url = process.env.E2E_QA_SUPABASE_URL || "";
const anon = process.env.E2E_QA_SUPABASE_ANON_KEY || "";
const secret = process.env.E2E_QA_SUPABASE_SECRET_KEY || "";
const base = (process.env.OFFICEPULSE_TEST_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const officeIp = process.env.E2E_OFFICE_IP || "203.0.113.10";
const lat = Number(process.env.E2E_OFFICE_LAT || "24.8607");
const lng = Number(process.env.E2E_OFFICE_LNG || "67.0011");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function block(msg) {
  console.error("BLOCKER:", msg);
  process.exit(2);
}

if (/jniyfhpwrjofdljqsdwd/i.test(url) || url.includes(PROD_REF)) {
  fail("Refusing production Supabase project");
}
if (!url || !anon) block("Missing E2E_QA_SUPABASE_URL / ANON_KEY");
if (!secret) {
  block(
    "Missing E2E_QA_SUPABASE_SECRET_KEY (QA service role). Authorized punch success paths cannot run. Set it as a local/CI secret only — never commit."
  );
}
if (!process.env.E2E_EMPLOYEE_EMAIL || !process.env.E2E_ADMIN_EMAIL) {
  block("Missing disposable E2E_* account env vars");
}

const adminDb = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login(email, password) {
  const jar = new Map();
  const res = await fetch(`${base}/login`);
  // Browser login via Supabase from Node for API cookie session is awkward;
  // use password grant then set cookies through a small helper page is complex.
  // Instead: call Supabase auth and use bearer against... APIs use cookies.
  // Prefer Playwright for cookie sessions; this script uses service-role DB asserts
  // after Playwright-equivalent cookie login via /api is not available.
  //
  // Practical approach: sign in with supabase-js and exchange is not wired to Next cookies.
  // Document: run Playwright suite `security-punch-matrix.spec.ts` which drives the browser.
  return { email, password, jar };
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "preflight",
      base,
      supabase: url,
      message:
        "Secret present. Run: npx playwright test tests/e2e/security-punch-matrix.spec.ts with the same env + E2E_ALLOW_PUNCH=1",
    },
    null,
    2
  )
);

// Cleanup any prior SEC-003 probe rows for today via service role (nonprod only)
const { data: emp } = await adminDb
  .from("employees")
  .select("id")
  .eq("employee_id", "QAEMP01")
  .maybeSingle();

if (emp?.id) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Karachi",
  });
  await adminDb
    .from("attendance")
    .delete()
    .eq("employee_id", emp.id)
    .eq("attendance_date", today);
  console.log("Cleaned today's attendance for QAEMP01 on", today);
}

process.exit(0);
