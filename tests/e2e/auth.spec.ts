import { test, expect } from "@playwright/test";
import { loginAs, expectLoggedOut } from "./helpers/auth";
import {
  adminEmail,
  adminPassword,
  employeeEmail,
  employeePassword,
  hasAdminCreds,
  hasEmployeeCreds,
  hasForcedPasswordCreds,
  hasViewerCreds,
  skipReasonMissing,
  viewerEmail,
  viewerPassword,
} from "./helpers/env";
import { requireOrSkip } from "./helpers/gates";

test.describe("Auth matrix @P0", () => {
  test("AUTH-001 valid employee login", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), employeePassword());
    await expect(page).toHaveURL(/\/(dashboard|change-password)/, {
      timeout: 30_000,
    });
    if (page.url().includes("change-password")) {
      test.info().annotations.push({
        type: "note",
        description: "Employee requires password change — AUTH-003 path.",
      });
      return;
    }
    await expect(page.getByText(/check in|check out|attendance/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("AUTH-002 wrong password", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), "definitely-wrong-password-xxx");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-003 first-login forced password change blocks attendance", async ({
    page,
  }) => {
    requireOrSkip(hasForcedPasswordCreds(), skipReasonMissing("force-password"));
    await loginAs(
      page,
      process.env.E2E_FORCE_PW_EMAIL!,
      process.env.E2E_FORCE_PW_PASSWORD!
    );
    await expect(page).toHaveURL(/\/change-password/, { timeout: 30_000 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/change-password/, { timeout: 30_000 });
  });

  test("AUTH-004 refresh / navigate preserves session", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/(dashboard|admin|change-password)/);
    if (page.url().includes("change-password")) {
      requireOrSkip(false, "Forced password change account — use dedicated employee.");
    }
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("AUTH-005 employee cannot open admin routes", async ({ page }) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/(dashboard|change-password)/);
    if (page.url().includes("change-password")) {
      requireOrSkip(false, "Forced password change account.");
    }
    await page.goto("/admin/dashboard");
    const res = await page.request.get("/api/admin/employees");
    expect([401, 403]).toContain(res.status());
  });

  test("AUTH-006 ADMIN_VIEWER write is forbidden", async ({ page }) => {
    requireOrSkip(hasViewerCreds(), skipReasonMissing("viewer"));
    await loginAs(page, viewerEmail(), viewerPassword());
    await page.waitForURL(/\/admin/);
    const res = await page.request.post("/api/admin/employees", {
      data: {
        name: "E2E Should Fail",
        email: `e2e-should-fail-${Date.now()}@example.com`,
        role: "EMPLOYEE",
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("AUTH-007 inactive employee cannot punch", async ({ page }) => {
    requireOrSkip(
      Boolean(
        process.env.E2E_INACTIVE_EMAIL && process.env.E2E_INACTIVE_PASSWORD
      ),
      skipReasonMissing("inactive employee")
    );
    await loginAs(
      page,
      process.env.E2E_INACTIVE_EMAIL!,
      process.env.E2E_INACTIVE_PASSWORD!
    );
    await expect(page.getByText(/inactive/i)).toBeVisible();
    await expectLoggedOut(page);
  });

  test("admin can reach admin dashboard", async ({ page }) => {
    requireOrSkip(hasAdminCreds(), skipReasonMissing("admin"));
    await loginAs(page, adminEmail(), adminPassword());
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
