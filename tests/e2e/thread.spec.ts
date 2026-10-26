import { expect, test, type Page } from "@playwright/test";
import { consult, onboardAsGuest, typeSituation } from "./helpers";

/**
 * The second visit. Everything here only happens once a case exists and the
 * user comes back to it: a follow-up, another take, a second persona, feedback,
 * deleting. That is the same shape as the bug that broke the cases list, which
 * was invisible until a list had something in it, so these paths get their own
 * file rather than riding along at the end of the first journey.
 *
 * Every test watches for a server error page and for an uncaught client error,
 * since both render as something that looks almost like a working screen.
 *
 * FIVE OF THESE ARE MARKED fixme. They are not wrong, and they are not flaky.
 * The case thread (screens.md section 12, screen F17), where B9 says every
 * follow-up, push back, new take and second persona is supposed to land, has
 * never been built. There is no route for it. ResultView stashes the request
 * with setPending and routes to /cases/[id], which is the screen it is already
 * on, and nothing anywhere calls takePending, so the request is dropped on the
 * floor: no network call, no new reply, no visible change. Verified with a
 * network probe, see docs/reviews/release-review-03.md finding P0-B.
 *
 * The API side is complete: posting action "followup" to /api/consult creates
 * the consult and the case then holds two. Only the screen is missing. These
 * tests should be un-fixme'd, not rewritten, when F17 lands.
 */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return errors;
}

async function expectNoServerError(page: Page): Promise<void> {
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
}

test.describe("coming back to a case", () => {
  test.fixme("a follow-up adds a second take to the thread", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "My manager took credit for my work in front of leadership and I do not know what to say tomorrow.");
    const before = await page.getByTestId("advice-cards").count();

    await typeSituation(page, "I tried that and he talked over me again in the stand up.");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("advice-cards")).toHaveCount(before + 1, { timeout: 40_000 });
    await expectNoServerError(page);
    expect(errors).toEqual([]);
  });

  test.fixme("another take adds a different line from the same persona", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "They lowballed my salary offer and I have to answer by Friday morning.");
    const before = await page.getByTestId("advice-cards").count();

    await page.getByTestId("another-take").click();
    await expect(page.getByTestId("advice-cards")).toHaveCount(before + 1, { timeout: 40_000 });
    await expectNoServerError(page);
    expect(errors).toEqual([]);
  });

  test.fixme("a second persona answers the same case", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "Two people on my team are in a cold war and I am stuck in the middle of it.");
    const before = await page.getByTestId("advice-cards").count();

    const ask = page.locator("[data-testid^='ask-']").first();
    await expect(ask).toBeEnabled();
    await ask.click();
    await expect(page.getByTestId("advice-cards")).toHaveCount(before + 1, { timeout: 40_000 });
    await expectNoServerError(page);
    expect(errors).toEqual([]);
  });

  test("feedback and saving both survive a reload", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "A client is sixty days late on an invoice and keeps saying the payment run is next week.");

    await page.getByTestId("save-line").first().click();
    const thumbs = page.getByTestId("feedback").getByRole("button").first();
    await thumbs.click();

    await page.reload();
    await expect(page.getByTestId("matter")).toBeVisible();
    await expectNoServerError(page);

    await page.goto("/saved");
    await expect(page.getByTestId("saved-line-card")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("deleting a case removes it from the list", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "I have to tell a supplier we are switching away from them after four years.");

    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /delete/i }).click();
    await page.getByTestId("confirm-delete-case").click();

    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await page.goto("/cases");
    await expect(page.getByTestId("case-row")).toHaveCount(0);
    await expectNoServerError(page);
    expect(errors).toEqual([]);
  });

  test.fixme("a case opened from the list renders its whole thread", async ({ page }) => {
    const errors = watchForErrors(page);
    await onboardAsGuest(page);
    await consult(page, "I was not invited to a planning meeting that I should have been in.");
    await page.getByTestId("another-take").click();
    await expect(page.getByTestId("advice-cards")).toHaveCount(2, { timeout: 40_000 });

    // Leave and come back the long way, through the list, so the server
    // component renders the thread from scratch rather than from router state.
    await page.goto("/cases");
    await page.getByTestId("case-row").first().click();
    await expect(page.getByTestId("matter")).toBeVisible();
    await expect(page.getByTestId("advice-cards")).toHaveCount(2);
    await expectNoServerError(page);
    expect(errors).toEqual([]);
  });
});
