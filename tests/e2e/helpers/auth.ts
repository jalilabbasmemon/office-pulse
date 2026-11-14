import { expect, type Page } from "@playwright/test";

/** Dismiss install banner if present (regression guard; auth pages should hide it). */
export async function dismissInstallPromptIfPresent(page: Page) {
  const dismiss = page.getByRole("button", { name: /got it|not now/i });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click({ force: true }).catch(() => undefined);
  }
}

export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await dismissInstallPromptIfPresent(page);

  // WebKit/iPhone often drops locator.fill on type=email; type explicitly.
  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.pressSequentially(email, { delay: 15 });
  await expect(emailInput).toHaveValue(email);
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(password, { delay: 10 });

  const signIn = page.getByRole("button", { name: /^sign in$/i });
  await signIn.waitFor({ state: "visible", timeout: 15_000 });
  try {
    await signIn.click({ timeout: 10_000 });
  } catch {
    // Last resort if a transient overlay races (should not happen after InstallPrompt fix).
    await signIn.click({ force: true, timeout: 5_000 });
  }
}

export async function expectLoggedOut(page: Page) {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
}
