import { expect, type Page } from "@playwright/test";

/**
 * Onboard as a guest and land on the home screen. The welcome screen is the
 * entry point for a browser with no cookies, so this is the first step of every
 * journey test.
 *
 * The click is retried because a click that lands before React has hydrated
 * hits a button with no handler attached and silently does nothing.
 */
export async function onboardAsGuest(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  const start = page.getByRole("button", { name: "Try it free" });
  await expect(start).toBeVisible();
  await expect(async () => {
    await start.click({ timeout: 2_000 });
    await expect(page).toHaveURL(/\/$/, { timeout: 4_000 });
  }).toPass({ timeout: 40_000 });
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/**
 * Put text in the composer and leave it there. Filling before hydration writes
 * the value into the DOM, React then hydrates with its own empty state and the
 * text is gone, leaving the send button disabled forever. Retrying the fill and
 * checking the value stuck is the reliable way through that window.
 */
export async function typeSituation(page: Page, situation: string): Promise<void> {
  const input = page.getByTestId("composer-input");
  await expect(input).toBeVisible();
  await expect(async () => {
    await input.fill(situation, { timeout: 2_000 });
    await expect(input).toHaveValue(situation, { timeout: 2_000 });
    await expect(page.getByTestId("send")).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/**
 * Type a situation, send it, and wait for the case screen to finish rendering.
 * The URL changes before the server component has streamed, so waiting on the
 * URL alone lands on the loading skeleton: every screen that follows, and every
 * screenshot, would be of the skeleton rather than the reply.
 */
export async function consult(page: Page, situation: string): Promise<void> {
  await typeSituation(page, situation);
  await page.getByTestId("send").click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/, { timeout: 40_000 });
  await expect(page.locator("[data-testid=matter], [data-testid=care-view]").first()).toBeVisible({ timeout: 40_000 });
}
