import { test, expect } from "@playwright/test";
import { safeInternalPath } from "../../lib/auth/safe-redirect";

test.describe("SEC-F-002 safeInternalPath @P0", () => {
  test("allows internal relative paths", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/admin/reports")).toBe("/admin/reports");
    expect(safeInternalPath("/change-password?forced=1")).toBe(
      "/change-password?forced=1"
    );
  });

  test("rejects absolute and protocol-relative URLs", () => {
    expect(safeInternalPath("https://evil.example/phish")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example")).toBe("/dashboard");
    expect(safeInternalPath("///evil.example")).toBe("/dashboard");
    expect(safeInternalPath("http://evil.example")).toBe("/dashboard");
  });

  test("rejects backslash and encoded tricks", () => {
    expect(safeInternalPath("/\\evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/%2f%2fevil.example")).toBe("/dashboard");
    expect(safeInternalPath("/%5cevil")).toBe("/dashboard");
  });

  test("rejects schemes and control characters", () => {
    expect(safeInternalPath("/javascript:alert(1)")).toBe("/dashboard");
    expect(safeInternalPath("/dashboard\r\nLocation: http://evil")).toBe(
      "/dashboard"
    );
    expect(safeInternalPath(null)).toBe("/dashboard");
    expect(safeInternalPath("")).toBe("/dashboard");
  });
});
