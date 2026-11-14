import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Attendance verification via authenticated public APIs only.
 * Privileged Supabase secrets must never be loaded into the browser or
 * Playwright page context — keep them on the Worker / local Next server.
 */

export async function fetchTodayAttendance(page: Page) {
  const res = await page.request.get("/api/attendance/today", {
    maxRedirects: 0,
  });
  expect(res.ok(), `today API ${res.status()}`).toBeTruthy();
  return res.json() as Promise<{
    attendance: {
      id: string;
      check_in_time: string | null;
      check_out_time: string | null;
      check_in_latitude: number | null;
      total_work_minutes: number | null;
      status: string;
      attendance_date: string;
    } | null;
    today: string;
  }>;
}

export async function fetchAttendanceHistory(page: Page) {
  const res = await page.request.get("/api/attendance/history", {
    maxRedirects: 0,
  });
  expect(res.ok(), `history API ${res.status()}`).toBeTruthy();
  return res.json() as Promise<{
    records?: Array<Record<string, unknown>>;
    attendance?: Array<Record<string, unknown>>;
  }>;
}

export async function fetchAuditLogs(page: Page) {
  const res = await page.request.get("/api/admin/audit-logs", {
    maxRedirects: 0,
  });
  expect(res.ok(), `audit API ${res.status()}`).toBeTruthy();
  return res.json() as Promise<{
    logs: Array<{ action: string; reason: string | null; entity_id: string }>;
  }>;
}

export async function adminListAttendance(
  page: Page,
  opts?: { date?: string; employeeId?: string }
) {
  const q = new URLSearchParams();
  if (opts?.date) q.set("date", opts.date);
  if (opts?.employeeId) q.set("employee_id", opts.employeeId);
  const res = await page.request.get(`/api/admin/attendance?${q}`, {
    maxRedirects: 0,
  });
  expect(res.ok(), `admin attendance ${res.status()}`).toBeTruthy();
  return res.json() as Promise<{
    records?: Array<{ id: string; check_in_time?: string; status?: string }>;
    attendance?: Array<{ id: string; check_in_time?: string; status?: string }>;
  }>;
}

/** Parallel punch helpers using the same cookie jar as the page. */
export async function postCheckIn(
  page: Page,
  body: Record<string, unknown>,
  ip: string
) {
  return page.request.post("/api/attendance/check-in", {
    data: body,
    headers: { "x-officepulse-e2e-ip": ip },
    maxRedirects: 0,
  });
}

export async function postCheckOut(
  page: Page,
  body: Record<string, unknown>,
  ip: string
) {
  return page.request.post("/api/attendance/check-out", {
    data: body,
    headers: { "x-officepulse-e2e-ip": ip },
    maxRedirects: 0,
  });
}

export async function assertDirectEmployeeWriteDenied(
  request: APIRequestContext,
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
) {
  const res = await request.post(`${supabaseUrl}/rest/v1/attendance`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    data: {
      employee_id: "00000000-0000-0000-0000-000000000001",
      attendance_date: "2099-01-01",
      check_in_time: new Date().toISOString(),
      status: "OPEN",
    },
    maxRedirects: 0,
  });
  expect([401, 403, 409]).toContain(res.status());
  expect(res.status()).not.toBe(201);
}
