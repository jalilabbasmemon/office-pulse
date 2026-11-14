import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

/**
 * OfficePulse cross-browser QA.
 * Browsers may live on D:\ms-playwright when C: is low on space —
 * set PLAYWRIGHT_BROWSERS_PATH accordingly before install/run.
 */
const baseURL = process.env.OFFICEPULSE_TEST_URL || "http://localhost:3000";

/** Load .env.qa.local into an object (server-side only — never injected into browser). */
function loadQaLocalEnv(): Record<string, string> {
  const file = path.join(__dirname, ".env.qa.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const qaLocal = loadQaLocalEnv();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.OFFICEPULSE_TEST_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer:
          !process.env.CI && process.env.E2E_FORCE_WEBSERVER !== "1",
        timeout: 120_000,
        env: {
          ...process.env,
          ...qaLocal,
          // Prefer QA local file over any production .env.local for the test server.
          NEXT_PUBLIC_SUPABASE_URL:
            qaLocal.NEXT_PUBLIC_SUPABASE_URL ||
            process.env.E2E_QA_SUPABASE_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL ||
            "",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
            qaLocal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            process.env.E2E_QA_SUPABASE_ANON_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            "",
          SUPABASE_SECRET_KEY:
            qaLocal.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_SECRET_KEY ||
            "",
          NEXT_PUBLIC_APP_ENV: qaLocal.NEXT_PUBLIC_APP_ENV || "qa",
          NEXT_PUBLIC_APP_URL:
            qaLocal.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          E2E_TRUSTED_IP_ADAPTER: "1",
          NODE_ENV: "development",
        },
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "webkit-iphone",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
      },
    },
    {
      name: "chromium-android",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
