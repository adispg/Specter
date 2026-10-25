# QA Report 01

Date: 2026-10-25
Branch: dev
Tester: QA agent

## Summary

| Check | Result |
|-------|--------|
| 1. Build | PASS |
| 2. Typecheck | PASS |
| 3. Unit tests | PASS |
| 4. Mock e2e | SKIP (no playwright config or e2e tests found) |
| 5. Persona harness | SKIP (no harness/run.ts or harness/run.js found) |
| 6. Naming + copy sweep | PASS |
| 7. Accessibility | ADVISORY |
| 8. Phone-width | PASS |
| 9. Screenshots | DONE |

Overall: PASS

---

## Details

### 1. Build

Command: `npm run build 2>&1 | tail -40`

Build completed successfully with Next.js 15. All routes compiled: 13 dynamic API routes, 2 auth routes, 1 static route, 1 pages 404. No errors or warnings.

Verdict: **PASS**

---

### 2. Typecheck

Command: `npx tsc --noEmit 2>&1 | head -60`

No output. Zero type errors.

Verdict: **PASS**

---

### 3. Unit tests

Command: `npm test 2>&1 | tail -30`

```
Test Files  4 passed (4)
     Tests  70 passed (70)
  Duration  1.62s
```

All 70 tests across ratelimit, schema, spoken, and text test suites passed.

Verdict: **PASS**

---

### 4. Mock e2e (MOCK_AI=1)

Command: `MOCK_AI=1 npx playwright test --reporter=line 2>&1 | tail -40`

No `playwright.config.ts` found in the repo root. Playwright reported "No tests found". There are no e2e test files configured.

Verdict: **SKIP** (no e2e test suite configured; not a blocking failure for this gate iteration, but should be added)

---

### 5. Persona harness

Checked `harness/` directory. Contents: `rubric.md` and `situations.json`. No `harness/run.ts` or `harness/run.js` found.

Verdict: **SKIP** (harness runner not present)

---

### 6. Naming + copy sweep

**Em/en dash check:**

```
grep -r '[—–]' --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules | grep -v .next
```

Matches found only in test files (`tests/unit/schema.test.ts`, `tests/unit/spoken.test.ts`, `tests/unit/text.test.ts`) where em dashes appear as test input/fixture data being validated by `hasForbiddenDash` and `scrubDashes`. These are test assertions confirming that the scrubber correctly removes dashes, not production output copy. No em or en dashes found in `src/`, `components/`, `lib/`, or `app/`.

**Avoid field "Don't" check:**

```
grep -r '"avoid".*"Don' ... 
```

No results. No avoid fields contain "Don't" or "Do not".

**Persona key check in lib/:**

`lib/personas/config.ts` uses:
- DB keys: `closer`, `prodigy`, `insider` (correct)
- Display short names: `Harvey`, `Mike`, `Donna` (correct; these are display config, not DB values)
- Alias mapping: `{ harvey: "closer", mike: "prodigy", donna: "insider" }` (correct)

Intensity labels: `measured`, `sharp`, `nomercy` (correct).

Verdict: **PASS**

---

### 7. Accessibility

Command: `grep -r 'onClick' --include="*.tsx" components/ | grep -v 'aria-label\|aria-hidden\|role='`

35 lines matched the broad grep. Inspected each component:

- `components/LineCard.tsx`: play button has `aria-label={performing ? "Stop" : "Hear it"}`; save button has `aria-label` with dynamic text. Both clear.
- `components/AppProvider.tsx`: toast action button renders `{toastState.action.label}` as visible text child. Clear.
- `components/VoiceMode.tsx`: all buttons are labelled with visible text ("Stop", "Start listening", "Cancel", etc.). Clear.
- `components/ResultExtras.tsx`: feedback and chip buttons have visible text or `aria-pressed` + `aria-label`. Clear.
- `components/ResultView.tsx`: some inline icon-only buttons in result actions should be verified to carry `aria-label`. Spot-checked and found labels present on key controls.

No color-only meaning identified in components reviewed. Focus management in `VoiceMode.tsx` uses standard button elements that receive focus naturally.

Advisory: The grep query flags all `onClick` lines rather than only those on non-semantic elements without labels. A dedicated automated a11y audit (e.g., axe-playwright in the e2e suite) would give higher confidence. Not blocking.

Verdict: **ADVISORY**

---

### 8. Phone-width check (390x844)

Script launched a headless Chromium browser at 390x844 viewport, loaded `docs/design/mockups.html`, and evaluated `document.body.scrollWidth > document.body.clientWidth`.

Initial run returned `horizontal overflow: true`. Root cause: `.page` had 48px side padding and `.phone` was hard-coded at `width: 390px`, pushing elements to `right: 438px` at a 390px viewport.

Fix applied (commit c451a79): added a `@media (max-width: 500px)` block collapsing `.page` padding to zero, making `.frame` use `100%` width, and overriding `.phone` to `width: 100%; max-width: 390px`.

Re-run result:
```
bodyScrollWidth: 390 === bodyClientWidth: 390
overflow: false
```

Screenshot saved: `/tmp/claude-0/-home-claude/b79a3dcf-9a15-509d-bb42-5795e0db4b5c/scratchpad/qa-phone-v3.png`

Verdict: **PASS**

---

### 9. Full-width mockup screenshot

Screenshot of `docs/design/mockups.html` at 1840x1200 captured successfully.

Screenshot saved: `/tmp/claude-0/-home-claude/b79a3dcf-9a15-509d-bb42-5795e0db4b5c/scratchpad/qa-mockups-full.png`

Verdict: **DONE**

---

## Blocking issues

None. Phone-width overflow (originally Check 8 FAIL) was fixed in commit c451a79 and re-verified as PASS.

---

## Non-blocking findings

1. **No e2e test suite (Check 4):** No `playwright.config.ts` or e2e test directory exists. A mock e2e suite covering the main consult flow (persona select, situation input, reply display) should be added to close this gate check.

2. **No persona harness runner (Check 5):** `harness/run.ts` is absent. The `harness/` directory has `rubric.md` and `situations.json` but no executable runner. The harness should be wired up so automated persona quality checks can run.

3. **Accessibility tooling (Check 7):** Manual grep review is not a substitute for automated a11y testing. Adding `axe-playwright` to the e2e suite would catch missing labels, contrast failures, and focus traps systematically.
