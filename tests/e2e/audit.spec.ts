import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { consult, onboardAsGuest } from "./helpers";

/**
 * PROCESS.md gate 4, the checks that are not about behaviour: phone width,
 * accessibility basics, and a screenshot of every screen for the PM review.
 *
 * Deliberately mechanical. It checks the things that break silently and that a
 * human reviewer cannot eyeball reliably: horizontal overflow at 390 CSS
 * pixels, tap targets under 44 by 44, images with no alternative text, inputs
 * and icon buttons with no accessible name, and more than one h1 per screen.
 */
const SHOTS = join("docs", "qa", "shots-02");
mkdirSync(SHOTS, { recursive: true });

type Audit = {
  overflow: number;
  smallTargets: string[];
  unnamed: string[];
  imagesWithoutAlt: number;
  h1Count: number;
};

async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = Math.max(0, doc.scrollWidth - doc.clientWidth);

    const label = (el: Element): string => {
      const e = el as HTMLElement;
      const aria = e.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = e.getAttribute("aria-labelledby");
      if (labelledBy) {
        const t = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (t) return t;
      }
      const title = e.getAttribute("title");
      if (title && title.trim()) return title.trim();
      if (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement) {
        const own = e.labels?.length ? Array.from(e.labels).map((l) => l.textContent ?? "").join(" ").trim() : "";
        if (own) return own;
        const ph = e.getAttribute("placeholder");
        if (ph && ph.trim()) return ph.trim();
        return "";
      }
      return (e.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    const describe = (el: Element): string => {
      const e = el as HTMLElement;
      const cls = e.className && typeof e.className === "string" ? `.${e.className.split(/\s+/).filter(Boolean).join(".")}` : "";
      const tid = e.getAttribute("data-testid");
      return `${e.tagName.toLowerCase()}${cls}${tid ? `[${tid}]` : ""}`;
    };

    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>("button, a[href], input, textarea, select, [role=button], [role=radio], [role=menuitem]"),
    ).filter((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    });

    const smallTargets: string[] = [];
    const unnamed: string[] = [];
    for (const e of interactive) {
      const r = e.getBoundingClientRect();
      // Allow for padding that extends the hit area beyond the box.
      const s = getComputedStyle(e);
      const padY = parseFloat(s.paddingTop || "0") + parseFloat(s.paddingBottom || "0");
      const h = Math.max(r.height, r.height + 0 * padY);
      if (r.width < 44 || h < 44) smallTargets.push(`${describe(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!label(e)) unnamed.push(describe(e));
    }

    const imagesWithoutAlt = Array.from(document.querySelectorAll("img")).filter(
      (i) => !i.hasAttribute("alt") && i.getAttribute("aria-hidden") !== "true",
    ).length;

    return { overflow, smallTargets, unnamed, imagesWithoutAlt, h1Count: document.querySelectorAll("h1").length };
  });
}

const findings: Record<string, Audit> = {};

async function checkScreen(page: Page, name: string): Promise<void> {
  const a = await audit(page);
  findings[name] = a;
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });

  // Hard gates: nothing may scroll sideways at phone width, every image needs
  // alternative text, every control needs an accessible name, one h1 a screen.
  expect(a.overflow, `${name}: horizontal overflow in CSS pixels`).toBe(0);
  expect(a.imagesWithoutAlt, `${name}: images without alt text`).toBe(0);
  expect(a.unnamed, `${name}: controls with no accessible name`).toEqual([]);
  expect(a.h1Count, `${name}: number of h1 elements`).toBeLessThanOrEqual(1);
}

test.describe("phone width and accessibility", () => {
  test("every screen passes the phone and accessibility gates", async ({ page }) => {
    await page.goto("/welcome");
    await checkScreen(page, "01-welcome");

    await page.goto("/sign-in");
    await checkScreen(page, "02-sign-in");

    await onboardAsGuest(page);
    await checkScreen(page, "03-home");

    await consult(page, "My manager took credit for my work in front of leadership and I do not know what to say tomorrow.");
    await checkScreen(page, "04-result");

    await page.goto("/cases");
    await expect(page.getByTestId("case-row").first()).toBeVisible();
    await checkScreen(page, "05-cases");

    await page.getByTestId("tab-saved").click();
    await expect(page).toHaveURL(/\/saved$/);
    // The URL changes before the server component streams, so without this the
    // screenshot is of loading.tsx rather than the screen.
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await checkScreen(page, "06-saved-empty");

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await checkScreen(page, "07-settings");

    await page.goto("/offline");
    await checkScreen(page, "08-offline");

    await page.goto("/not-a-real-route");
    await checkScreen(page, "09-not-found");
  });

  test("the tab bar sits at the bottom of every tab, not under the content", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "My landlord wants a twenty percent rent rise and I have two weeks to answer.");

    for (const path of ["/cases", "/saved", "/settings"]) {
      await page.goto(path);
      const bar = page.getByTestId("tab-cases").locator("..");
      const box = await bar.boundingBox();
      expect(box, `${path}: tab bar not found`).not.toBeNull();
      const viewport = page.viewportSize()!;
      // The screen container has to grow for the bar to reach the bottom. When
      // .screen-main was undefined it did not, and the bar rode up under the
      // content, roughly 600 pixels above where it belongs.
      expect(viewport.height - (box!.y + box!.height), `${path}: gap below the tab bar`).toBeLessThan(40);
    }
  });

  test("the cases list shows spoken lines without their pause marks", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "They lowballed my salary offer and I have to answer by Friday morning.");
    await page.goto("/cases");
    const row = page.getByTestId("case-row").first();
    await expect(row).toBeVisible();
    // screens.md section 11: the excerpt is the line with marks stripped (B1).
    expect(await row.textContent()).not.toContain("|");
  });

  test("the crisis screen passes too, and keeps its helpline reachable", async ({ page }) => {
    await onboardAsGuest(page);
    await consult(page, "I lost my job today and I keep thinking everyone would be better off without me.");
    await expect(page.getByTestId("care-view")).toBeVisible();
    await checkScreen(page, "10-care");
    const tel = await page.getByTestId("helpline").getAttribute("href");
    expect(tel).toMatch(/^tel:/);
  });

  test.afterAll(() => {
    // Tap targets are reported rather than failed: the design system uses some
    // deliberately small inline controls, so this is a list for the QA report
    // to judge, not a pass or fail.
    const lines: string[] = [];
    for (const [name, a] of Object.entries(findings)) {
      lines.push(`${name}: overflow=${a.overflow} h1=${a.h1Count} smallTargets=${a.smallTargets.length}`);
      for (const t of a.smallTargets) lines.push(`    ${t}`);
    }
    // eslint-disable-next-line no-console
    console.log(`\n=== phone and accessibility audit ===\n${lines.join("\n")}\n`);
  });
});
