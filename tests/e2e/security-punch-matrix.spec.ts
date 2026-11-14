import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { attachE2eIpHeader, installGeolocationMock } from "./helpers/geo";
import {
  adminEmail,
  adminPassword,
  employeeEmail,
  employeePassword,
  e2eOfficeCoords,
  e2eOfficeIp,
  hasAdminCreds,
  hasEmployeeCreds,
  hasForcedPasswordCreds,
  hasViewerCreds,
  skipReasonMissing,
  viewerEmail,
  viewerPassword,
} from "./helpers/env";
import { requireOrSkip } from "./helpers/gates";
import { resetQaEmployeeTodayAttendance } from "./helpers/qa-admin";
import {
  fetchAuditLogs,
  fetchTodayAttendance,
  postCheckIn,
  postCheckOut,
} from "./helpers/verify";

/**
 * SEC-004 authorized punch matrix.
 *
 * Punches: normal authenticated HTTP. Server holds SUPABASE_SECRET_KEY.
 * Playwright does not need a privileged key for attendance actions.
 * Optional .env.qa.local secret is used only by Node fixture resetQaEmployeeTodayAttendance.
 */
const qaUrl =
  process.env.E2E_QA_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function assertNonprod() {
  if (/jniyfhpwrjofdljqsdwd/i.test(qaUrl)) {
    throw new Error("Refusing production Supabase");
  }
}

const OFF_NET_IP = "198.51.100.50";

async function ensureCleanDay() {
  const reset = await resetQaEmployeeTodayAttendance("QAEMP01");
  if (!reset.ok) {
    // Agent/MCP may have cleared the row; continue and let API assert emptiness.
    test.info().annotations.push({
      type: "setup",
      description: `Fixture reset skipped: ${reset.reason}`,
    });
  }
}

test.describe("SEC-004 authorized punch matrix @P0", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    assertNonprod();
  });

  test.beforeEach(() => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    requireOrSkip(
      process.env.E2E_ALLOW_PUNCH === "1",
      "Set E2E_ALLOW_PUNCH=1 on nonprod only"
    );
  });

  test("1-2 GPS check-in / check-out + duplicate rejection + today verify", async ({
    page,
  }) => {
    await ensureCleanDay();
    const coords = e2eOfficeCoords();
    await installGeolocationMock(page, coords);
    await attachE2eIpHeader(page, OFF_NET_IP);
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 30_000 });
    if (page.url().includes("change-password")) {
      requireOrSkip(false, "Use non-force-password employee");
    }

    const cin = await postCheckIn(page, coords, OFF_NET_IP);
    const cinBody = await cin.json().catch(() => ({}));
    expect(
      cin.ok(),
      `check-in ${cin.status()} ${JSON.stringify(cinBody)}`
    ).toBeTruthy();
    expect(cinBody.attendance?.check_in_time).toBeTruthy();
    expect(cinBody.wifiOnly).not.toBe(true);

    const afterIn = await fetchTodayAttendance(page);
    expect(afterIn.attendance?.check_in_time).toBeTruthy();
    expect(afterIn.attendance?.check_out_time).toBeNull();
    expect(afterIn.attendance?.check_in_latitude).not.toBeNull();

    const dupIn = await postCheckIn(page, coords, OFF_NET_IP);
    expect(dupIn.status()).toBe(409);

    const cout = await postCheckOut(page, coords, OFF_NET_IP);
    const coutBody = await cout.json().catch(() => ({}));
    expect(
      cout.ok(),
      `check-out ${cout.status()} ${JSON.stringify(coutBody)}`
    ).toBeTruthy();

    const afterOut = await fetchTodayAttendance(page);
    expect(afterOut.attendance?.check_out_time).toBeTruthy();
    expect(afterOut.attendance?.total_work_minutes).not.toBeNull();

    const dupOut = await postCheckOut(page, coords, OFF_NET_IP);
    expect([400, 409]).toContain(dupOut.status());
  });

  test("3-4 office-IP fallback check-in and check-out", async ({ page }) => {
    await ensureCleanDay();
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    const cin = await postCheckIn(page, {}, e2eOfficeIp());
    const body = await cin.json().catch(() => ({}));
    expect(
      cin.ok(),
      `wifi check-in ${cin.status()} ${JSON.stringify(body)}`
    ).toBeTruthy();
    expect(body.wifiOnly).toBe(true);

    const mid = await fetchTodayAttendance(page);
    expect(mid.attendance?.check_in_time).toBeTruthy();

    const cout = await postCheckOut(page, {}, e2eOfficeIp());
    expect(cout.ok(), await cout.text()).toBeTruthy();
    const done = await fetchTodayAttendance(page);
    expect(done.attendance?.check_out_time).toBeTruthy();
  });

  test("5 concurrent punch requests — single winner", async ({ page }) => {
    await ensureCleanDay();
    const coords = e2eOfficeCoords();
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    const [a, b, c] = await Promise.all([
      postCheckIn(page, coords, OFF_NET_IP),
      postCheckIn(page, coords, OFF_NET_IP),
      postCheckIn(page, coords, OFF_NET_IP),
    ]);
    const statuses = [a.status(), b.status(), c.status()];
    const oks = statuses.filter((s) => s >= 200 && s < 300).length;
    const conflicts = statuses.filter((s) => s === 409).length;
    expect(oks).toBe(1);
    expect(conflicts).toBe(2);
  });

  test("6-7 ADMIN correction + audit + export", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    let today = await fetchTodayAttendance(page);

    if (!today.attendance?.check_in_time) {
      const cin = await postCheckIn(page, e2eOfficeCoords(), OFF_NET_IP);
      expect(cin.ok(), await cin.text()).toBeTruthy();
      today = await fetchTodayAttendance(page);
    }
    const attendanceId = today.attendance!.id;
    const originalIn = today.attendance!.check_in_time!;

    await loginAs(page, adminEmail(), adminPassword());
    await page.waitForURL(/\/admin/, { timeout: 30_000 });

    const reason = `SEC-004 correction ${Date.now()}`;
    const correctedIn = new Date(
      new Date(originalIn).getTime() - 60_000
    ).toISOString();
    const res = await page.request.post(
      `/api/admin/attendance/${attendanceId}/correct`,
      {
        data: {
          reason,
          check_in_time: correctedIn,
          check_out_time: today.attendance?.check_out_time ?? undefined,
        },
        maxRedirects: 0,
      }
    );
    expect(res.ok(), await res.text()).toBeTruthy();

    const { logs } = await fetchAuditLogs(page);
    const hit = logs.find(
      (l) => l.entity_id === attendanceId && (l.reason || "").includes("SEC-004")
    );
    expect(hit, "audit log for correction").toBeTruthy();

    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    const verify = await fetchTodayAttendance(page);
    expect(verify.attendance?.id).toBe(attendanceId);

    await loginAs(page, adminEmail(), adminPassword());
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    const month = new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
      .slice(0, 7);
    const exportRes = await page.request.get(
      `/api/admin/attendance/export?month=${month}`,
      { maxRedirects: 0 }
    );
    expect(exportRes.ok(), `export ${exportRes.status()}`).toBeTruthy();
    const ct = exportRes.headers()["content-type"] || "";
    expect(ct).toMatch(/spreadsheet|octet-stream|xlsx|zip/i);
    const buf = await exportRes.body();
    expect(buf.byteLength).toBeGreaterThan(100);
  });
});

test.describe("SEC-004 authz rejection paths @P0", () => {
  test("ADMIN_VIEWER correction rejected", async ({ page }) => {
    requireOrSkip(hasViewerCreds(), skipReasonMissing("viewer"));
    await loginAs(page, viewerEmail(), viewerPassword());
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    const res = await page.request.post(
      "/api/admin/attendance/00000000-0000-0000-0000-000000000001/correct",
      {
        data: { reason: "SEC-004", check_in_time: new Date().toISOString() },
        maxRedirects: 0,
      }
    );
    expect([401, 403, 404]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("inactive employee cannot punch", async ({ page }) => {
    requireOrSkip(
      Boolean(process.env.E2E_INACTIVE_EMAIL && process.env.E2E_INACTIVE_PASSWORD),
      skipReasonMissing("inactive")
    );
    await loginAs(
      page,
      process.env.E2E_INACTIVE_EMAIL!,
      process.env.E2E_INACTIVE_PASSWORD!
    );
    await expect(page.getByText(/inactive/i)).toBeVisible({ timeout: 20_000 });
  });

  test("forced-password cannot punch via API", async ({ page }) => {
    requireOrSkip(hasForcedPasswordCreds(), skipReasonMissing("force-password"));
    await loginAs(
      page,
      process.env.E2E_FORCE_PW_EMAIL!,
      process.env.E2E_FORCE_PW_PASSWORD!
    );
    await expect(page).toHaveURL(/\/change-password/, { timeout: 30_000 });
    const res = await postCheckIn(page, e2eOfficeCoords(), e2eOfficeIp());
    expect([401, 403]).toContain(res.status());
  });

  test("anonymous punch rejected", async ({ request }) => {
    const res = await request.post("/api/attendance/check-in", {
      data: e2eOfficeCoords(),
      maxRedirects: 0,
    });
    expect([401, 302, 303, 307, 308, 403]).toContain(res.status());
  });

  test("invalid GPS + unauthorized IP rejected", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 30_000 });
    if (page.url().includes("change-password")) {
      requireOrSkip(false, "Use non-force-password employee");
    }
    const res = await postCheckIn(
      page,
      { latitude: 0, longitude: 0, accuracy: 5 },
      OFF_NET_IP
    );
    const body = await res.json().catch(() => ({}));
    expect(
      res.status(),
      `unexpected ${res.status()} body=${JSON.stringify(body)}`
    ).not.toBe(200);
    expect([400, 403, 409, 500]).toContain(res.status());
    if (res.status() === 400 || res.status() === 403) {
      expect([
        "OUTSIDE_OFFICE",
        "GPS_ACCURACY_TOO_LOW",
        "GPS_REQUIRED",
      ]).toContain(body.code);
    }
  });
});
