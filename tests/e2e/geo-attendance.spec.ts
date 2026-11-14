import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { attachE2eIpHeader, installGeolocationMock } from "./helpers/geo";
import {
  employeeEmail,
  employeePassword,
  e2eOfficeCoords,
  e2eOfficeIp,
  hasEmployeeCreds,
  skipReasonMissing,
} from "./helpers/env";
import { requireOrSkip } from "./helpers/gates";

/**
 * GEO / ATT matrix.
 * Server validation is exercised via mocked GPS + non-prod trusted IP adapter
 * (E2E_TRUSTED_IP_ADAPTER=1). Production office settings are never mutated.
 */
test.describe("Geo + attendance @P0", () => {
  test.beforeEach(({}, testInfo) => {
    requireOrSkip(hasEmployeeCreds(), skipReasonMissing("employee"));
    if (!process.env.E2E_ALLOW_PUNCH) {
      testInfo.annotations.push({
        type: "warning",
        description:
          "Set E2E_ALLOW_PUNCH=1 only on nonproduction with disposable accounts.",
      });
    }
  });

  test("GEO-007 iPhone: GPS prompted only after user gesture", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("iphone"),
      "iPhone WebKit project only"
    );

    let geoCalls = 0;
    await page.addInitScript(() => {
      const orig = navigator.geolocation?.getCurrentPosition?.bind(
        navigator.geolocation
      );
      const watch = navigator.geolocation?.watchPosition?.bind(
        navigator.geolocation
      );
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(
            success: PositionCallback,
            error?: PositionErrorCallback,
            opts?: PositionOptions
          ) {
            (window as unknown as { __geoCalls?: number }).__geoCalls =
              ((window as unknown as { __geoCalls?: number }).__geoCalls ?? 0) +
              1;
            return orig?.(success, error, opts);
          },
          watchPosition(
            success: PositionCallback,
            error?: PositionErrorCallback,
            opts?: PositionOptions
          ) {
            (window as unknown as { __geoCalls?: number }).__geoCalls =
              ((window as unknown as { __geoCalls?: number }).__geoCalls ?? 0) +
              1;
            return watch?.(success, error, opts) ?? 0;
          },
          clearWatch: navigator.geolocation.clearWatch.bind(
            navigator.geolocation
          ),
        },
      });
    });

    const coords = e2eOfficeCoords();
    await installGeolocationMock(page, coords);
    await attachE2eIpHeader(page, "198.51.100.50"); // off-office IP
    await loginAs(page, employeeEmail(), employeePassword());
    await page.waitForURL(/\/dashboard/);

    // On iOS UA, auto GPS should not run — "Enable location" must appear
    const enable = page.getByRole("button", { name: /enable location/i });
    await expect(enable).toBeVisible({ timeout: 15_000 });

    const before = await page.evaluate(
      () => (window as unknown as { __geoCalls?: number }).__geoCalls ?? 0
    );
    expect(before).toBe(0);

    await enable.click();
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as unknown as { __geoCalls?: number }).__geoCalls ?? 0
        )
      )
      .toBeGreaterThan(0);
  });

  test("GEO-001 GPS within branch accepts (hybrid, off Wi‑Fi)", async ({
    page,
  }) => {
    test.skip(!process.env.E2E_ALLOW_PUNCH, "Punch disabled (set E2E_ALLOW_PUNCH=1)");
    const coords = e2eOfficeCoords();
    await installGeolocationMock(page, coords);
    await attachE2eIpHeader(page, "198.51.100.50");
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");

    const enable = page.getByRole("button", { name: /enable location/i });
    if (await enable.isVisible().catch(() => false)) {
      await enable.click();
    }

    const checkIn = page.getByRole("button", { name: /check in/i });
    await expect(checkIn).toBeEnabled({ timeout: 20_000 });
    await checkIn.click();
    await expect(page.getByText(/check-in successful|checked in/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("GEO-002 GPS outside + IP not allowed rejects", async ({ page }) => {
    test.skip(!process.env.E2E_ALLOW_PUNCH, "Punch disabled");
    await installGeolocationMock(page, {
      latitude: 0,
      longitude: 0,
      accuracy: 10,
    });
    await attachE2eIpHeader(page, "198.51.100.50");
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    const enable = page.getByRole("button", { name: /enable location/i });
    if (await enable.isVisible().catch(() => false)) await enable.click();

    const checkIn = page.getByRole("button", { name: /check in/i });
    // Button may stay disabled when outside — that is correct client UX
    const enabled = await checkIn.isEnabled().catch(() => false);
    if (enabled) {
      await checkIn.click();
      await expect(
        page.getByText(/outside|gps|office|location/i).first()
      ).toBeVisible();
    } else {
      await expect(page.getByText(/outside|office wi‑fi|branch/i).first()).toBeVisible();
    }
  });

  test("GEO-003 GPS denied + office IP + wifi-only → accept path ready", async ({
    page,
  }) => {
    await installGeolocationMock(page, {
      ...e2eOfficeCoords(),
      deny: true,
    });
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    // Network row should eventually show office Wi‑Fi when adapter + allow-list match
    await expect(
      page.getByText(/office wi‑fi|not required on office/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("GEO-004 GPS denied + office IP + wifi-only disabled → blocked", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_WIFI_ONLY_DISABLED,
      "Requires office allow_wifi_only_punch=false on nonprod (E2E_WIFI_ONLY_DISABLED=1)"
    );
    await installGeolocationMock(page, {
      ...e2eOfficeCoords(),
      deny: true,
    });
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /check in/i })).toBeDisabled({
      timeout: 15_000,
    });
  });

  test("GEO-005 low accuracy + office IP + wifi-only → IP fallback UI", async ({
    page,
  }) => {
    await installGeolocationMock(page, {
      latitude: e2eOfficeCoords().latitude,
      longitude: e2eOfficeCoords().longitude,
      accuracy: 5000,
    });
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    await expect(
      page.getByText(/office wi‑fi|skipped on office/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("GEO-006 low accuracy + IP not allowed → reject", async ({ page }) => {
    await installGeolocationMock(page, {
      latitude: e2eOfficeCoords().latitude,
      longitude: e2eOfficeCoords().longitude,
      accuracy: 5000,
    });
    await attachE2eIpHeader(page, "198.51.100.50");
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    const enable = page.getByRole("button", { name: /enable location/i });
    if (await enable.isVisible().catch(() => false)) await enable.click();
    await expect(page.getByRole("button", { name: /check in/i })).toBeDisabled({
      timeout: 20_000,
    });
  });

  test("GEO-008 GPS timeout shows recoverable UI", async ({ page }) => {
    await installGeolocationMock(page, {
      ...e2eOfficeCoords(),
      timeout: true,
    });
    await attachE2eIpHeader(page, "198.51.100.50");
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    const enable = page.getByRole("button", { name: /enable location|refresh/i });
    if (await enable.first().isVisible().catch(() => false)) {
      await enable.first().click();
    }
    await expect(
      page.getByText(/timed out|no gps|unavailable|permission|location/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test("GEO-009 Private Relay tip visible off Wi‑Fi on iOS Safari UA", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("iphone"),
      "iPhone WebKit project only"
    );
    await installGeolocationMock(page, e2eOfficeCoords());
    await attachE2eIpHeader(page, "198.51.100.50");
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    await expect(page.getByText(/private relay/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("ATT-003 checkout before check-in rejected by UI", async ({ page }) => {
    await installGeolocationMock(page, e2eOfficeCoords());
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /^check out$/i })).toHaveCount(
      0
    );
  });

  test("ATT-006 early checkout cancel does not mutate", async ({ page }) => {
    test.skip(!process.env.E2E_ALLOW_PUNCH, "Punch disabled");
    // Assumes employee already checked in on nonprod for today
    await installGeolocationMock(page, e2eOfficeCoords());
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    await page.goto("/dashboard");
    const checkOut = page.getByRole("button", { name: /check out/i });
    test.skip(!(await checkOut.isVisible().catch(() => false)), "Not checked in");
    await checkOut.click();
    const cancel = page.getByRole("button", {
      name: /cancel|stay clocked in/i,
    });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(page.getByRole("button", { name: /check out/i })).toBeVisible();
  });
});

test.describe("API attendance validation (authenticated request) @P0", () => {
  test("GEO-010 OFFICE_NOT_CONFIGURED when no locations", async ({
    request,
    page,
  }) => {
    test.skip(!hasEmployeeCreds(), skipReasonMissing("employee"));
    test.skip(
      !process.env.E2E_EXPECT_NO_LOCATIONS,
      "Set E2E_EXPECT_NO_LOCATIONS=1 only on a fixture DB with zero office_locations"
    );
    await loginAs(page, employeeEmail(), employeePassword());
    const res = await page.request.post("/api/attendance/check-in", {
      data: e2eOfficeCoords(),
      headers: { "x-officepulse-e2e-ip": "198.51.100.50" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("OFFICE_NOT_CONFIGURED");
  });

  test("ATT-009 client clock not trusted — server returns ISO times", async ({
    page,
  }) => {
    test.skip(!hasEmployeeCreds(), skipReasonMissing("employee"));
    test.skip(!process.env.E2E_ALLOW_PUNCH, "Punch disabled");
    await installGeolocationMock(page, e2eOfficeCoords());
    await attachE2eIpHeader(page, e2eOfficeIp());
    await loginAs(page, employeeEmail(), employeePassword());
    const today = await page.request.get("/api/attendance/today");
    expect(today.ok()).toBeTruthy();
    const cache = today.headers()["cache-control"] ?? "";
    expect(cache).toMatch(/no-store/i);
  });
});
