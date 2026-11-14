import { test, expect } from "@playwright/test";

/**
 * Regression for confirmed WebKit/iPhone defect:
 * InstallPrompt overlay intercepted Sign in taps on /login.
 */
test.describe("Safari install prompt must not block auth @P0", () => {
  test("GEO/UI: login Sign in is clickable without dismiss on iPhone WebKit", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("iphone"),
      "iPhone WebKit project only"
    );
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();

    // Banner must not render on auth-critical paths after fix.
    await expect(
      page.getByRole("button", { name: /got it|not now/i })
    ).toHaveCount(0);

    const signIn = page.getByRole("button", { name: /sign in/i });
    await expect(signIn).toBeVisible();
    const box = await signIn.boundingBox();
    expect(box).toBeTruthy();

    // Click must not be intercepted (would timeout previously).
    await signIn.click({ trial: true });
  });
});
