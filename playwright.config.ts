import { defineConfig } from "@playwright/test";

/**
 * End to end tests, PROCESS.md gate 4. Everything runs in mock mode: MOCK_AI=1
 * serves the fixtures in lib/consult/mock.ts, and with no Supabase env vars set
 * MOCK_AUTH kicks in, so the suite needs no keys, no network and no database.
 *
 * Quotas are raised for the run only. Each test gets a fresh browser context,
 * so it is a fresh guest with a fresh device cookie, but the IP is shared and
 * the defaults (one guest consult per device, five per IP per day) would start
 * failing tests part way through the file for the wrong reason.
 *
 * Phone first: 390 by 844 is the viewport the design system is written against.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : [["line"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      MOCK_AI: "1",
      MOCK_AUTH: "1",
      GUEST_CONSULTS: "50",
      GUEST_CONSULTS_PER_DEVICE_PER_DAY: "50",
      GUEST_CONSULTS_PER_IP_PER_DAY: "500",
      FREE_CONSULTS_PER_WEEK: "0",
    },
  },
});
