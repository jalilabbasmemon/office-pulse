import { test } from "@playwright/test";

/**
 * P0 auth/punch tests must not silently skip in release CI.
 * - Default local: skip with reason (dev convenience)
 * - E2E_REQUIRE_AUTH=1: hard-fail when fixtures/creds missing
 */
export function requireOrSkip(condition: boolean, reason: string) {
  if (condition) return;
  if (process.env.E2E_REQUIRE_AUTH === "1") {
    throw new Error(`P0 required fixture missing: ${reason}`);
  }
  test.skip(true, reason);
}
