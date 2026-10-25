"use client";
import { useEffect, useState } from "react";
import type { PublicConfig } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IconGoogle, IconMail } from "./Icons";
import { ErrorBanner } from "./ui";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/**
 * Google and email magic link sign in. When the visitor is a guest, the guest
 * account is linked instead (Supabase identity linking keeps the same user id, so
 * the guest's case stays with the account). In MOCK_AI mode it signs in a test user.
 */
export function SignInForm({ config, linkGuest, next = "/", onDone }: { config: PublicConfig; linkGuest: boolean; next?: string; onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const valid = EMAIL.test(email.trim());

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const sb = () => createSupabaseBrowserClient(config.supabaseUrl, config.supabaseAnonKey);

  async function google() {
    setError(null);
    setBusy("google");
    try {
      const client = sb();
      if (linkGuest) {
        const { error: e } = await client.auth.linkIdentity({ provider: "google", options: { redirectTo: redirectTo() } });
        if (!e) return;
      }
      const { error: e2 } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
      if (e2) throw e2;
    } catch {
      setBusy(null);
      setError("Couldn't reach Google. Try again.");
    }
  }

  async function sendLink() {
    setTouched(true);
    if (!valid) return;
    setError(null);
    setBusy("email");
    const addr = email.trim().toLowerCase();
    try {
      if (config.authMode === "mock") {
        const res = await fetch("/api/auth/mock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: addr }) });
        if (!res.ok) throw new Error("mock sign in failed");
        onDone?.();
        window.location.assign(next);
        return;
      }
      const client = sb();
      if (linkGuest) {
        const { error: e } = await client.auth.updateUser({ email: addr }, { emailRedirectTo: redirectTo() });
        if (!e) {
          setSentTo(addr);
          setResendIn(30);
          return;
        }
        // The email already has an account: sign in to it instead (the guest case is not merged).
      }
      const { error: e2 } = await client.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
      if (e2) throw e2;
      setSentTo(addr);
      setResendIn(30);
    } catch {
      setError("Couldn't send the link. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (config.authMode === "unconfigured") {
    return (
      <div className="banner warn" role="status">
        <span>Sign in isn&apos;t configured on this server. Set the Supabase variables (see README), or run with MOCK_AI=1.</span>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="stack" style={{ gap: 14, justifyItems: "start" }} data-testid="link-sent">
        <span style={{ color: "var(--success)" }}>
          <IconMail width={40} height={40} />
        </span>
        <h2 className="t-hero">Check your inbox.</h2>
        <p className="small">We sent a sign-in link to {sentTo}. It expires in 15 minutes.</p>
        <button type="button" className="textbtn" disabled={resendIn > 0 || busy !== null} onClick={sendLink}>
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend link"}
        </button>
        <button type="button" className="textbtn" onClick={() => setSentTo(null)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {config.authMode === "supabase" && (
        <>
          <button type="button" className="btn google" onClick={google} disabled={busy !== null}>
            <IconGoogle />
            {busy === "google" ? "Opening Google" : "Continue with Google"}
          </button>
          <div className="divider">or</div>
        </>
      )}
      {config.authMode === "mock" && <p className="small">Test mode: any email signs in a test user. No email is sent.</p>}
      <form
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          void sendLink();
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@work.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && email.length > 0 && !valid ? "true" : "false"}
            data-testid="email"
          />
          {touched && email.length > 0 && !valid && (
            <span className="small" style={{ color: "var(--danger)" }}>
              That doesn&apos;t look like an email.
            </span>
          )}
        </div>
        <button type="submit" className="btn primary" disabled={!valid || busy !== null} data-testid="send-link">
          {busy === "email" ? "Sending" : config.authMode === "mock" ? "Continue" : "Send me a link"}
        </button>
      </form>
    </div>
  );
}
