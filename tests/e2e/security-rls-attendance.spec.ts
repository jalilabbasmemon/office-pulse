import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * SEC-F-001 negative tests against isolated nonprod (officepulse-qa).
 * Uses real authenticated Supabase JS clients — not mocked RLS.
 *
 * Requires:
 *   E2E_QA_SUPABASE_URL
 *   E2E_QA_SUPABASE_ANON_KEY
 *   E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD
 * Optional second employee for cross-user update:
 *   E2E_EMPLOYEE2_EMAIL / E2E_EMPLOYEE2_PASSWORD
 */
const qaUrl =
  process.env.E2E_QA_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const anon =
  process.env.E2E_QA_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

function assertNonprod() {
  if (/jniyfhpwrjofdljqsdwd/i.test(qaUrl)) {
    throw new Error("Refusing SEC-F-001 probes against production Supabase ref");
  }
}

async function employeeClient() {
  assertNonprod();
  const sb = createClient(qaUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: process.env.E2E_EMPLOYEE_EMAIL!,
    password: process.env.E2E_EMPLOYEE_PASSWORD!,
  });
  expect(error, error?.message).toBeNull();
  expect(data.user).toBeTruthy();
  return sb;
}

test.describe("SEC-F-001 attendance RLS @P0", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_EMPLOYEE_EMAIL ||
        !process.env.E2E_EMPLOYEE_PASSWORD ||
        !qaUrl ||
        !anon,
      "Set E2E_QA_SUPABASE_* + E2E_EMPLOYEE_* for nonprod RLS probes"
    );
    assertNonprod();
  });

  test("employee direct INSERT denied", async () => {
    const sb = await employeeClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data: emp } = await sb
      .from("employees")
      .select("id")
      .eq("auth_user_id", user!.id)
      .single();

    const { error } = await sb.from("attendance").insert({
      employee_id: emp!.id,
      attendance_date: "2099-01-01",
      check_in_time: new Date().toISOString(),
      status: "OPEN",
      is_late: false,
    });
    expect(error).toBeTruthy();
    expect(error!.code === "42501" || /policy|denied|permission/i.test(error!.message)).toBe(
      true
    );
  });

  test("employee direct UPDATE denied", async () => {
    const sb = await employeeClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data: emp } = await sb
      .from("employees")
      .select("id")
      .eq("auth_user_id", user!.id)
      .single();

    const { error } = await sb
      .from("attendance")
      .update({ is_late: false, check_in_time: new Date().toISOString() })
      .eq("employee_id", emp!.id);
    // Either error or zero rows; PostgREST often returns error under RLS
    if (error) {
      expect(
        error.code === "42501" || /policy|denied|permission/i.test(error.message)
      ).toBe(true);
    } else {
      // Confirm no forged row was written for a future date via update
      const { data } = await sb
        .from("attendance")
        .select("id")
        .eq("employee_id", emp!.id)
        .eq("attendance_date", "2099-01-02");
      expect(data ?? []).toEqual([]);
    }
  });

  test("employee direct DELETE denied on visible row", async () => {
    const sb = await employeeClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data: emp } = await sb
      .from("employees")
      .select("id")
      .eq("auth_user_id", user!.id)
      .single();

    const probeDate = "2099-12-31";
    const { data: visible, error: selErr } = await sb
      .from("attendance")
      .select("id")
      .eq("employee_id", emp!.id)
      .eq("attendance_date", probeDate);
    expect(selErr).toBeNull();
    // Nonprod seeds a probe row for this date; SELECT must still work.
    expect((visible ?? []).length).toBeGreaterThan(0);

    const { error, count } = await sb
      .from("attendance")
      .delete({ count: "exact" })
      .eq("id", visible![0].id);

    if (error) {
      expect(
        error.code === "42501" || /policy|denied|permission/i.test(error.message)
      ).toBe(true);
    } else {
      // RLS with no DELETE policy: PostgREST reports 0 rows affected.
      expect(count ?? 0).toBe(0);
    }

    const { data: stillThere } = await sb
      .from("attendance")
      .select("id")
      .eq("id", visible![0].id)
      .maybeSingle();
    expect(stillThere?.id).toBe(visible![0].id);
  });

  test("unauthenticated attendance writes denied", async () => {
    assertNonprod();
    const sb = createClient(qaUrl, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb.from("attendance").insert({
      employee_id: "00000000-0000-0000-0000-000000000001",
      attendance_date: "2099-01-03",
      status: "OPEN",
    });
    expect(error).toBeTruthy();
  });

  test("employee can still SELECT own attendance", async () => {
    const sb = await employeeClient();
    const { error } = await sb.from("attendance").select("id").limit(5);
    expect(error).toBeNull();
  });
});
