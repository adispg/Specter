import { expect, type Page } from "@playwright/test";

/**
 * Onboard as a guest and land on the home screen. The welcome screen is the
 * entry point for a browser with no cookies, so this is the first step of every
 * journey test.
 */
export async function onboardAsGuest(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: "Try it free" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await expect(page.getByTestId("composer-input")).toBeVisible();
}

/**
 * Type a situation, send it, and wait for the case screen to finish rendering.
 * The URL changes before the server component has streamed, so waiting on the
 * URL alone lands on the loading skeleton: every screen that follows, and every
 * screenshot, would be of the skeleton rather than the reply.
 */
export async function consult(page: Page, situation: string): Promise<void> {
  await page.getByTestId("composer-input").fill(situation);
  await page.getByTestId("send").click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/, { timeout: 40_000 });
  await expect(page.locator("[data-testid=matter], [data-testid=care-view]").first()).toBeVisible({ timeout: 40_000 });
}
