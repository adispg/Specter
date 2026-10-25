"use client";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { SignInForm } from "./SignInForm";
import { Sheet } from "./ui";

/**
 * "Keep this case?" (design review B3). Shown to guests after their first reply
 * finishes speaking, and without "Not now" when they try a second consult.
 * Signing in links the guest account, so the case moves to the account.
 */
export function KeepCaseSheet() {
  const { user, config, keepCase, closeKeepCase } = useApp();
  const path = usePathname() ?? "/";
  if (!user.isGuest) return null;
  return (
    <Sheet open={keepCase.open} onClose={keepCase.forced ? () => undefined : closeKeepCase} label="Keep this case?" testId="keep-case-sheet">
      <h2 className="t2">{keepCase.forced ? "Sign in to keep going." : "Keep this case?"}</h2>
      <p className="small">
        {keepCase.forced
          ? "Your free guest consult is used. Sign in and your case comes with you."
          : "Sign in to save it, and the lines you liked, across devices. It takes a minute."}
      </p>
      <SignInForm config={config} linkGuest next={path} onDone={closeKeepCase} />
      {keepCase.forced ? (
        <button type="button" className="btn ghost" onClick={closeKeepCase}>
          Back to my case
        </button>
      ) : (
        <button type="button" className="btn ghost" onClick={closeKeepCase} data-testid="not-now">
          Not now
        </button>
      )}
    </Sheet>
  );
}
