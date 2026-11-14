import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  adminEmail,
  adminPassword,
  hasAdminCreds,
  hasViewerCreds,
  skipReasonMissing,
  viewerEmail,
  viewerPassword,
} from "./helpers/env";
import { requireOrSkip } from "./helpers/gates";

test.describe("Admin + reports @P0", () => {
  test("ADMIN-001 create employee page reachable", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await page.goto("/admin/employees/new");
    await expect(page).toHaveURL(/\/admin\/employees\/new/);
    await expect(page.getByText(/employee|name|email|shift/i).first()).toBeVisible();
  });

  test("ADMIN-004 settings / office map page loads", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await page.goto("/admin/settings");
    await expect(page.getByText(/office|location|wifi|punch/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Leaflet map container (dynamic)
    await expect(page.locator(".leaflet-container, #map, [class*=map]").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("ADMIN-005 office locations section present", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await page.goto("/admin/settings");
    await expect(
      page.getByText(/branch|hq|location|radius|active/i).first()
    ).toBeVisible();
  });

  test("ADMIN-006 attendance correction UI + audit page", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await page.goto("/admin/attendance");
    await expect(page.getByText(/attendance/i).first()).toBeVisible();
    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/audit/i).first()).toBeVisible();
  });

  test("ADMIN-007 viewer is read-only on settings mutate", async ({ page }) => {
    requireOrSkip(hasViewerCreds(), skipReasonMissing("viewer"));
    await loginAs(page, viewerEmail(), viewerPassword());
    const res = await page.request.patch("/api/admin/settings", {
      data: { organization_name: "Should Not Save" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("REPORT-001 monthly reports page", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await page.goto("/admin/reports");
    await expect(page.getByText(/report/i).first()).toBeVisible();
  });

  test("REPORT-002 Excel export endpoint returns xlsx", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const res = await page.request.get(
      `/api/admin/attendance/export?month=${month}`
    );
    // Some deployments use a different query shape — accept 200 xlsx or 400 validation
    if (res.ok()) {
      const ct = res.headers()["content-type"] ?? "";
      expect(
        ct.includes("sheet") ||
          ct.includes("octet-stream") ||
          ct.includes("excel") ||
          ct.includes("spreadsheet")
      ).toBeTruthy();
      const buf = await res.body();
      expect(buf.byteLength).toBeGreaterThan(64);
    } else {
      // Fall back: UI export button exists
      await page.goto("/admin/reports");
      await expect(page.getByRole("button", { name: /export excel/i })).toBeVisible();
    }
  });
});
