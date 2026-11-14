import { test, expect } from "@playwright/test";
import { collectConsoleAndFailedRequests } from "./helpers/geo";

test.describe("Public smoke @P0", () => {
  test("login page loads without browser errors", async ({ page }) => {
    const { consoleErrors } = await collectConsoleAndFailedRequests(page);
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("mobile login does not overflow horizontally", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("PWA-001 manifest and icons load", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name || manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");

    for (const icon of manifest.icons ?? []) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.ok(), `icon ${icon.src}`).toBeTruthy();
    }
  });

  test("PWA-003 service worker does not cache HTML/API", async ({
    request,
  }) => {
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    const body = await sw.text();
    expect(body).toMatch(/Do NOT cache HTML\/API/i);
    expect(body).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    expect(body).toMatch(/request\.mode === "navigate"/);
  });
});
