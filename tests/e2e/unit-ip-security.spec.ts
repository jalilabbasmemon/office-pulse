import { test, expect } from "@playwright/test";
import {
  getRequestIp,
  isE2eTrustedIpAdapterEnabled,
  isProductionRuntime,
  isStrictProductionAppEnv,
  normalizeIp,
} from "../../lib/network/ip";

function fakeRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        return key ? headers[key] : null;
      },
    },
  } as unknown as import("next/server").NextRequest;
}

/** NODE_ENV is typed read-only; tests must mutate it. */
function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

test.describe("E2E IP adapter security @P0", () => {
  const prev = { ...process.env };

  test.afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in prev)) delete process.env[key];
    }
    Object.assign(process.env, prev);
  });

  test("adapter disabled on strict production APP_ENV even if flag set", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    expect(isStrictProductionAppEnv()).toBe(true);
    expect(isE2eTrustedIpAdapterEnabled()).toBe(false);
  });

  test("adapter disabled when NODE_ENV=production without qa APP_ENV", () => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_APP_ENV;
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    expect(isProductionRuntime()).toBe(true);
    expect(isE2eTrustedIpAdapterEnabled()).toBe(false);
  });

  test("QA Worker APP_ENV=qa allows adapter under NODE_ENV=production", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_ENV = "qa";
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    process.env.NEXT_PUBLIC_APP_URL =
      "https://office-pulse-qa.jalilabbasmemon.workers.dev";
    expect(isStrictProductionAppEnv()).toBe(false);
    expect(isProductionRuntime()).toBe(false);
    expect(isE2eTrustedIpAdapterEnabled()).toBe(true);
    const ip = getRequestIp(
      fakeRequest({ "x-officepulse-e2e-ip": "203.0.113.10" })
    );
    expect(ip).toBe("203.0.113.10");
  });

  test("adapter disabled when flag unset in development", () => {
    setNodeEnv("development");
    delete process.env.E2E_TRUSTED_IP_ADAPTER;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(isE2eTrustedIpAdapterEnabled()).toBe(false);
  });

  test("cf-connecting-ip always wins over x-officepulse-e2e-ip", () => {
    setNodeEnv("development");
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    const ip = getRequestIp(
      fakeRequest({
        "cf-connecting-ip": "203.0.113.50",
        "x-officepulse-e2e-ip": "198.51.100.10",
        "x-forwarded-for": "198.51.100.10",
      })
    );
    expect(ip).toBe("203.0.113.50");
  });

  test("production ignores e2e header and XFF without cf-connecting-ip", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    const ip = getRequestIp(
      fakeRequest({
        "x-officepulse-e2e-ip": "198.51.100.10",
        "x-forwarded-for": "203.0.113.9",
      })
    );
    expect(ip).toBe("0.0.0.0");
  });

  test("nonprod local adapter accepts e2e header when no CF IP", () => {
    setNodeEnv("development");
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const ip = getRequestIp(
      fakeRequest({
        "x-officepulse-e2e-ip": "203.0.113.10",
      })
    );
    expect(ip).toBe("203.0.113.10");
  });

  test("normalizeIp strips IPv4-mapped and zones", () => {
    expect(normalizeIp("::ffff:203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80::1");
  });

  test("production without CF IP ignores XFF and X-Real-IP (SEC-F-005)", () => {
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    delete process.env.E2E_TRUSTED_IP_ADAPTER;
    const ip = getRequestIp(
      fakeRequest({
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "203.0.113.10",
        "x-officepulse-e2e-ip": "203.0.113.10",
      })
    );
    expect(ip).toBe("0.0.0.0");
  });

  test("NEXT_PUBLIC_APP_ENV=production blocks E2E_NONPROD_HOST override (SEC-F-010)", () => {
    setNodeEnv("development");
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.E2E_TRUSTED_IP_ADAPTER = "1";
    process.env.E2E_NONPROD_HOST = "1";
    process.env.NEXT_PUBLIC_APP_URL = "https://office-pulse.workers.dev";
    expect(isE2eTrustedIpAdapterEnabled()).toBe(false);
  });
});
