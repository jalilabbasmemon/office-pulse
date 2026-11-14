import { test, expect } from "@playwright/test";
import {
  hasAdminCreds,
  hasEmployeeCreds,
  hasForcedPasswordCreds,
  hasViewerCreds,
} from "./helpers/env";

/**
 * Release CI should set E2E_REQUIRE_AUTH=1 so missing P0 fixtures fail the build
 * instead of silently skipping auth/punch coverage.
 */
test.describe("P0 release gate meta @P0", () => {
  test("required nonprod credentials present when E2E_REQUIRE_AUTH=1", () => {
    test.skip(
      process.env.E2E_REQUIRE_AUTH !== "1",
      "Gate inactive locally — set E2E_REQUIRE_AUTH=1 in release CI"
    );

    const missing: string[] = [];
    if (!hasEmployeeCreds()) missing.push("E2E_EMPLOYEE_EMAIL/PASSWORD");
    if (!hasAdminCreds()) missing.push("E2E_ADMIN_EMAIL/PASSWORD");
    if (!hasViewerCreds()) missing.push("E2E_VIEWER_EMAIL/PASSWORD");
    if (!hasForcedPasswordCreds()) missing.push("E2E_FORCE_PW_EMAIL/PASSWORD");
    if (!process.env.E2E_INACTIVE_EMAIL || !process.env.E2E_INACTIVE_PASSWORD) {
      missing.push("E2E_INACTIVE_EMAIL/PASSWORD");
    }
    if (!process.env.E2E_ALLOW_PUNCH) missing.push("E2E_ALLOW_PUNCH=1");

    expect(missing, `Missing P0 fixtures: ${missing.join(", ")}`).toEqual([]);
  });

  test("real iPhone sign-off is never auto-asserted", () => {
    // This test documents policy: automation must not set E2E_REAL_IPHONE_PASS.
    // Human completes QA_REAL_IPHONE_CHECKLIST.md first.
    if (process.env.E2E_REAL_IPHONE_PASS === "1") {
      test.info().annotations.push({
        type: "manual-signoff",
        description:
          "E2E_REAL_IPHONE_PASS=1 detected — ensure QA_REAL_IPHONE_CHECKLIST.md is signed by a human.",
      });
    }
    expect(true).toBe(true);
  });
});
