import { test, expect } from "@playwright/test";
import { validateAttendanceLocation } from "../../lib/attendance/validate";
import type { OfficeLocation, OfficeSettings } from "../../types";

/**
 * Server-side hybrid punch matrix (no browser, no DB mutation).
 * Mirrors GEO-001…GEO-010 acceptance rules from the QA plan.
 */
const office = (overrides: Partial<OfficeSettings> = {}): OfficeSettings => ({
  id: "office-1",
  office_name: "E2E",
  address: null,
  latitude: 24.8607,
  longitude: 67.0011,
  allowed_radius_meters: 150,
  office_public_ip: "203.0.113.10",
  allowed_office_ips: ["203.0.113.10"],
  max_gps_accuracy_meters: 100,
  allow_wifi_only_punch: true,
  timezone: "Asia/Karachi",
  created_at: "",
  updated_at: "",
  ...overrides,
});

const hq: OfficeLocation = {
  id: "loc-1",
  name: "HQ",
  address: null,
  latitude: 24.8607,
  longitude: 67.0011,
  allowed_radius_meters: 150,
  allowed_public_ips: [],
  is_active: true,
  sort_order: 0,
  created_at: "",
  updated_at: "",
};

const branchB: OfficeLocation = {
  id: "loc-2",
  name: "Branch B",
  address: null,
  latitude: 24.87,
  longitude: 67.02,
  allowed_radius_meters: 120,
  allowed_public_ips: ["198.51.100.20"],
  is_active: true,
  sort_order: 1,
  created_at: "",
  updated_at: "",
};

test.describe("validateAttendanceLocation matrix @P0", () => {
  test("GEO-001 GPS inside branch accepts even if IP not allowlisted", () => {
    const result = validateAttendanceLocation(
      { latitude: 24.8607, longitude: 67.0011, accuracy: 20 },
      office(),
      [hq],
      "198.51.100.50"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wifiOnly).toBe(false);
      expect(result.storeGps).toBe(true);
      expect(result.locationName).toBe("HQ");
    }
  });

  test("GEO-002 GPS outside + IP not allowed rejects OUTSIDE_OFFICE", () => {
    const result = validateAttendanceLocation(
      { latitude: 0, longitude: 0, accuracy: 10 },
      office(),
      [hq],
      "198.51.100.50"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("OUTSIDE_OFFICE");
  });

  test("GEO-003 GPS missing + office IP + wifi-only accepts", () => {
    const result = validateAttendanceLocation(
      null,
      office({ allow_wifi_only_punch: true }),
      [hq],
      "203.0.113.10"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wifiOnly).toBe(true);
      expect(result.locationName).toBe("Office Wi‑Fi");
    }
  });

  test("GEO-003b per-location IP labels that branch on wifi-only punch", () => {
    const result = validateAttendanceLocation(
      null,
      office({
        allow_wifi_only_punch: true,
        office_public_ip: null,
        allowed_office_ips: [],
      }),
      [hq, branchB],
      "198.51.100.20"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wifiOnly).toBe(true);
      expect(result.locationId).toBe("loc-2");
      expect(result.locationName).toBe("Branch B");
    }
  });

  test("GEO-004 GPS missing + office IP + wifi-only disabled → GPS_REQUIRED", () => {
    const result = validateAttendanceLocation(
      null,
      office({ allow_wifi_only_punch: false }),
      [hq],
      "203.0.113.10"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GPS_REQUIRED");
  });

  test("GEO-005 low accuracy + office IP + wifi-only → IP fallback", () => {
    const result = validateAttendanceLocation(
      { latitude: 24.8607, longitude: 67.0011, accuracy: 5000 },
      office({ allow_wifi_only_punch: true }),
      [hq],
      "203.0.113.10"
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wifiOnly).toBe(true);
  });

  test("GEO-006 low accuracy + IP not allowed → GPS_ACCURACY_TOO_LOW", () => {
    const result = validateAttendanceLocation(
      { latitude: 24.8607, longitude: 67.0011, accuracy: 5000 },
      office(),
      [hq],
      "198.51.100.50"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GPS_ACCURACY_TOO_LOW");
  });

  test("GEO-010 no active locations → OFFICE_NOT_CONFIGURED", () => {
    const result = validateAttendanceLocation(
      { latitude: 24.8607, longitude: 67.0011, accuracy: 10 },
      office(),
      [{ ...hq, is_active: false }],
      "203.0.113.10"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("OFFICE_NOT_CONFIGURED");
  });

  test("GEO-009 Private Relay style IP must not false-match office", () => {
    const result = validateAttendanceLocation(
      null,
      office(),
      [hq],
      "198.51.100.99" // relay egress, not office
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GPS_REQUIRED");
  });
});
