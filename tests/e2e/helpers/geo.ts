import type { Page } from "@playwright/test";

export type MockGps = {
  latitude: number;
  longitude: number;
  accuracy: number;
  /** Simulate permission denial */
  deny?: boolean;
  /** Simulate timeout / unavailable */
  timeout?: boolean;
  /** Delay before first fix (ms) */
  delayMs?: number;
};

/**
 * Install a navigator.geolocation mock before any page script runs.
 * Call from beforeEach / before page.goto for punch flows.
 */
export async function installGeolocationMock(page: Page, gps: MockGps) {
  await page.addInitScript((cfg) => {
    const reading = {
      coords: {
        latitude: cfg.latitude,
        longitude: cfg.longitude,
        accuracy: cfg.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    const fail = (cb: PositionErrorCallback | null | undefined, code: number) => {
      const err = {
        code,
        message:
          code === 1
            ? "User denied Geolocation"
            : code === 3
              ? "Timeout expired"
              : "Position unavailable",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError;
      window.setTimeout(() => cb?.(err), cfg.delayMs ?? 0);
    };

    const succeed = (cb: PositionCallback) => {
      window.setTimeout(() => cb(reading as GeolocationPosition), cfg.delayMs ?? 0);
    };

    const geo: Geolocation = {
      getCurrentPosition(success, error) {
        if (cfg.deny) return fail(error, 1);
        if (cfg.timeout) return fail(error, 3);
        succeed(success);
      },
      watchPosition(success, error) {
        if (cfg.deny) {
          fail(error, 1);
          return 1;
        }
        if (cfg.timeout) {
          fail(error, 3);
          return 1;
        }
        succeed(success);
        return 1;
      },
      clearWatch() {},
    };

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      get: () => geo,
    });
  }, gps);
}

/** Attach trusted E2E IP header to same-origin API calls (non-prod adapter only). */
export async function attachE2eIpHeader(page: Page, ip: string) {
  await page.route("**/api/**", async (route) => {
    const headers = {
      ...route.request().headers(),
      "x-officepulse-e2e-ip": ip,
    };
    await route.continue({ headers });
  });
}

export async function collectConsoleAndFailedRequests(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (err) => {
    const msg = err.message;
    if (/password|token|apikey|secret|credential/i.test(msg)) return;
    consoleErrors.push(msg);
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/password|token|apikey|secret|credential/i.test(text)) return;
    consoleErrors.push(text);
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    if (/supabase\.co.*auth|apikey=/i.test(url)) {
      failedRequests.push(`${req.method()} [redacted-auth-url]`);
      return;
    }
    failedRequests.push(`${req.method()} ${url} :: ${req.failure()?.errorText ?? ""}`);
  });

  return { consoleErrors, failedRequests };
}
