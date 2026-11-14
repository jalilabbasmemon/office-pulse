import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  employeeEmail,
  employeePassword,
  hasEmployeeCreds,
  hasForcedPasswordCreds,
  hasViewerCreds,
  skipReasonMissing,
  viewerEmail,
  viewerPassword,
} from "./helpers/env";
import { requireOrSkip } from "./helpers/gates";
import { safeInternalPath } from "../../lib/auth/safe-redirect";

test.describe("Security authz + middleware @P0", () => {
  test("anonymous cannot read today attendance API", async ({ request }) => {
    const res = await request.get("/api/attendance/today", {
      maxRedirects: 0,
    });
    expect([401, 302, 303, 307, 308]).toContain(res.status());
  });

  test("anonymous check-in API denied", async ({ request }) => {
    const res = await request.post("/api/attendance/check-in", {
      data: { latitude: 24.86, longitude: 67.0, accuracy: 10 },
      maxRedirects: 0,
    });
    expect([401, 302, 303, 307, 308, 403]).toContain(res.status());
  });

  test("auth callback rejects open redirects (header)", async ({ request }) => {
    const probes = [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example/",
      "/%2f%2fevil.example",
    ];
    for (const next of probes) {
      const res = await request.get(
        `/api/auth/callback?next=${encodeURIComponent(next)}&code=invalid`,
        { maxRedirects: 0 }
      );
      const location = res.headers()["location"] ?? "";
      expect(location.toLowerCase()).not.toContain("evil.example");
      expect(safeInternalPath(next)).toBe("/dashboard");
    }
  });

  test("employee admin API forbidden", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/(dashboard|change-password)/);
    if (page.url().includes("change-password")) {
      requireOrSkip(false, "Use non-force-password employee");
    }
    const res = await page.request.get("/api/admin/employees");
    expect([401, 403]).toContain(res.status());
  });

  test("ADMIN_VIEWER cannot correct attendance", async ({ page }) => {
    requireOrSkip(hasViewerCreds(), skipReasonMissing("viewer"));
    await loginAs(page, viewerEmail(), viewerPassword());
    await page.waitForURL(/\/admin/);
    const res = await page.request.post(
      "/api/admin/attendance/00000000-0000-0000-0000-000000000099/correct",
      {
        data: {
          reason: "SEC test",
          check_in_time: new Date().toISOString(),
        },
      }
    );
    expect([401, 403, 404]).toContain(res.status());
    // Must not be 200
    expect(res.status()).not.toBe(200);
  });

  test("forced-password account cannot punch via API", async ({ page }) => {
    requireOrSkip(hasForcedPasswordCreds(), skipReasonMissing("force-password"));
    await loginAs(
      page,
      process.env.E2E_FORCE_PW_EMAIL!,
      process.env.E2E_FORCE_PW_PASSWORD!
    );
    await expect(page).toHaveURL(/\/change-password/);
    const res = await page.request.post("/api/attendance/check-in", {
      data: { latitude: 24.8607, longitude: 67.0011, accuracy: 10 },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("browser nav: force-password gated (forced)", async ({ page }) => {
    requireOrSkip(hasForcedPasswordCreds(), skipReasonMissing("force-password"));
    await loginAs(
      page,
      process.env.E2E_FORCE_PW_EMAIL!,
      process.env.E2E_FORCE_PW_PASSWORD!
    );
    await expect(page).toHaveURL(/\/change-password/, { timeout: 30_000 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/change-password/);
    const api = await page.request.get("/api/attendance/today");
    expect([401, 403]).toContain(api.status());
  });
});
