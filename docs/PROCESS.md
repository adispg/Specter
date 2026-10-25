# Release process (founder's rule)

Nothing ships without both gates passing, every time.

1. Design change: the designer updates docs/design/ (design-system.md, screens.md, mockups.html).
2. PM design review: the product manager reviews every screen, every layout and every user journey from a modern consumer angle (Gen Z and the 30 to 40 crowd), plus naming and copy consistency. Output: docs/reviews/design-review-NN.md with blocking and non-blocking findings and an explicit sign-off line. Blocking findings go back to the designer.
3. Build: the engineer implements on a branch, with unit and e2e tests green.
4. QA gate: the tester runs build, typecheck, unit, e2e (mock mode), the persona harness, a copy and naming consistency sweep (persona names, labels, intensity names, no em or en dashes), accessibility and phone-width checks, and screenshots every screen. Output: docs/qa/qa-report-NN.md with pass or fail per check. Failures go back to the engineer and are re-tested.
5. PM product review on the built app: the PM walks every journey on the tester's screenshots and the preview deploy and signs off in docs/reviews/release-review-NN.md.
6. Merge to main and deploy. Vercel builds a preview for every branch and production from main.
