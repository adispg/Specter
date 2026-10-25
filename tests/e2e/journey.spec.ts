import { expect, test } from "@playwright/test";
import { consult, onboardAsGuest } from "./helpers";

test.describe("guest journey", () => {
  test("a cold visitor is sent to welcome, not a 404", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("radiogroup", { name: "Choose your advisor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try it free" })).toBeVisible();
  });

  test("picking a persona and continuing as a guest reaches the home screen", async ({ page }) => {
    await page.goto("/welcome");
    const cards = page.getByRole("radio");
    await expect(cards).toHaveCount(3);
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Try it free" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId("composer-input")).toBeVisible();
  });

  test("a situation produces a case with a line and a plan", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "My manager took credit for my work in front of leadership and I do not know what to say tomorrow.");
    await expect(page.getByTestId("matter")).toBeVisible();
    await expect(page.getByTestId("advice-cards")).toBeVisible();
    await expect(page.getByTestId("situation-echo")).toContainText("took credit");
  });

  test("a starter fills the composer without sending", async ({ page }) => {
    await onboardAsGuest(page);
    const starter = page.locator("button.starter").first();
    const label = (await starter.textContent())?.trim() ?? "";
    expect(label.length).toBeGreaterThan(0);
    await starter.click();
    await expect(page.getByTestId("composer-input")).toHaveValue(label);
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("navigation chrome", () => {
  test("the home screen offers a working mic where dictation is supported", async ({ page }) => {
    await onboardAsGuest(page);
    const mic = page.locator(".composer button.mic");
    await expect(mic).toHaveCount(1);
    await expect(mic).toBeEnabled();
    await expect(mic).toHaveAttribute("aria-label", "Speak instead");
  });

  test("the home screen draws no mic at all where dictation is unsupported", async ({ page }) => {
    // P2-C, P2-F, N3: the Composer used to render the mic unconditionally, so a
    // device with no dictation got an icon that silently did nothing. Strip the
    // speech APIs before any page script runs, which is what an unsupported
    // browser looks like, and the button must not be there.
    await page.addInitScript(() => {
      for (const k of ["SpeechRecognition", "webkitSpeechRecognition", "MediaRecorder"]) {
        Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true });
      }
    });
    await onboardAsGuest(page);
    await expect(page.getByTestId("composer-input")).toBeVisible();
    await expect(page.locator(".composer button.mic")).toHaveCount(0);
  });

  test("the result screen shows one bottom element, not a stacked pair", async ({ page }) => {
    await onboardAsGuest(page);
    await expect(page.locator("nav, [data-testid^='tab-']").first()).toBeVisible();
    await consult(page, "My landlord wants a twenty percent rent rise and I have two weeks to answer.");
    // P2-D: the case screen owns the bottom with its own composer, so the tab
    // bar must not be there as well.
    await expect(page.getByTestId("tab-cases")).toHaveCount(0);
    await expect(page.getByTestId("tab-saved")).toHaveCount(0);
  });

  test("the tab bar reaches cases and saved", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "A client is sixty days late on an invoice and keeps saying the payment run is next week.");
    await page.goto("/");
    await page.getByTestId("tab-cases").click();
    await expect(page).toHaveURL(/\/cases$/);
    const rows = page.getByTestId("case-row");
    await expect(rows).toHaveCount(1);
    await rows.first().click();
    await expect(page).toHaveURL(/\/cases\/[^/]+$/);
    await page.goBack();
    await page.getByTestId("tab-saved").click();
    await expect(page).toHaveURL(/\/saved$/);
  });

  test("a saved line appears on the saved list", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "I have to tell a supplier we are switching away from them after four years.");
    await page.getByTestId("save-line").first().click();
    await page.goto("/saved");
    // Both lists render a relative timestamp server side. When relTime lived in
    // a "use client" module this threw and the screen was a server error, so
    // these two tests only pass with content in the list.
    await expect(page.getByTestId("saved-line-card")).toHaveCount(1);
  });
});

test.describe("edge screens", () => {
  test("an unknown route gets the branded 404 with a way back", async ({ page }) => {
    await onboardAsGuest(page);
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: "Wrong room." })).toBeVisible();
    const back = page.getByRole("link", { name: "Back to home" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the offline fallback page renders and offers a retry", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "No connection." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  });

  test("the manifest and service worker are served", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBeTruthy();
    const body = (await manifest.json()) as { name?: string; icons?: unknown[] };
    expect(body.icons?.length).toBeGreaterThan(0);
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain("/offline");
  });
});
