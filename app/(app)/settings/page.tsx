"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { TabBar, ErrorBanner } from "@/components/ui";
import { BRAND } from "@/lib/personas/config";

function Row({ label, value, href, onClick }: { label: string; value?: string; href?: string; onClick?: () => void }) {
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: onClick || href ? "pointer" : "default",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span style={{ fontSize: 15, color: "var(--fg-1)" }}>{label}</span>
      {value && <span style={{ fontSize: 14, color: "var(--fg-3)" }}>{value}</span>}
    </div>
  );

  if (href) {
    return <a href={href} style={{ textDecoration: "none", display: "block" }}>{content}</a>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left" }}>{content}</button>;
  }
  return <div>{content}</div>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: "20px 16px 6px",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--fg-3)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {title}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!res.ok) throw new Error("Sign out failed. Try again.");
      router.push("/welcome");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header style={{ padding: "16px var(--gutter-r) 0 var(--gutter-l)" }}>
        <h1 className="t1" style={{ fontSize: 20 }}>Settings</h1>
      </header>

      <main className="screen-main" style={{ paddingTop: 8 }}>
        {error && (
          <div style={{ padding: "0 16px 8px" }}>
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}

        {user.isGuest ? (
          <>
            <SectionHeader title="Account" />
            <div
              style={{
                margin: "8px 16px",
                padding: 16,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5, marginBottom: 12 }}>
                You are using a guest session. Create an account to save your cases across devices.
              </p>
              <a
                href="/sign-up"
                className="cta"
                style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 0" }}
              >
                Create account
              </a>
            </div>
          </>
        ) : (
          <>
            <SectionHeader title="Account" />
            <Row label="Email" value={user.email ?? "Connected"} />
            <Row
              label="Sign out"
              onClick={handleSignOut}
            />
          </>
        )}

        <SectionHeader title="App" />
        <Row label="Version" value="1.0" />
        <Row label="Privacy policy" href="/legal/privacy" />
        <Row label="Terms of service" href="/legal/terms" />

        <div style={{ padding: "40px 16px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.6 }}>
            Advice is for perspective only. Not professional legal, financial, or other counsel.
          </p>
          <p style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8 }}>
            {BRAND.appName} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
