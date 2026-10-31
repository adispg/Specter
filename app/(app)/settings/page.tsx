"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { TabBar, ErrorBanner, Sheet } from "@/components/ui";
import { VoicePicker } from "@/components/VoicePicker";
import { BRAND } from "@/lib/personas/config";
import { api } from "@/lib/client/api";

function Row({ label, value, href, onClick, danger }: { label: string; value?: string; href?: string; onClick?: () => void; danger?: boolean }) {
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
      <span style={{ fontSize: 15, color: danger ? "var(--danger)" : "var(--fg-1)" }}>{label}</span>
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

/** Confirmation sheet used for all destructive actions. */
function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Sheet open={open} onClose={busy ? () => undefined : onCancel} label={title}>
      <h2 className="t2">{title}</h2>
      <p className="small" style={{ marginBottom: 20 }}>{body}</p>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={onConfirm}
        style={{
          width: "100%",
          background: "var(--danger)",
          borderColor: "var(--danger)",
          marginBottom: 10,
        }}
      >
        {busy ? "Working..." : confirmLabel}
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={onCancel}
        style={{ width: "100%" }}
      >
        Cancel
      </button>
    </Sheet>
  );
}

type Modal = "delete-cases" | "delete-account" | null;

export default function SettingsPage() {
  const { user, toast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [exporting, setExporting] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/auth/signout", { method: "POST" });
      if (!res.ok) throw new Error("Sign out failed. Try again.");
      router.push("/welcome");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `specter-data-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Data exported", { ok: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteCases() {
    setBusy(true);
    try {
      await api("/api/cases/all", { method: "DELETE" });
      setModal(null);
      toast("All cases deleted", { ok: true });
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setBusy(true);
    try {
      await api("/api/account", { method: "DELETE" });
      setModal(null);
      router.push("/welcome");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
            <Row label="Sign out" onClick={handleSignOut} />

            <SectionHeader title="Your data" />
            <Row
              label={exporting ? "Exporting..." : "Export my data"}
              onClick={exporting ? undefined : handleExport}
            />
            <Row
              label="Delete all cases"
              onClick={() => setModal("delete-cases")}
              danger
            />
            <Row
              label="Delete account"
              onClick={() => setModal("delete-account")}
              danger
            />
          </>
        )}

        <SectionHeader title="Voice" />
        <VoicePicker />

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

      <ConfirmSheet
        open={modal === "delete-cases"}
        title="Delete all cases?"
        body="This permanently removes every case and consult. Saved lines will also be deleted. This cannot be undone."
        confirmLabel="Delete all cases"
        onConfirm={() => void handleDeleteCases()}
        onCancel={() => setModal(null)}
        busy={busy}
      />

      <ConfirmSheet
        open={modal === "delete-account"}
        title="Delete account?"
        body="This permanently deletes your account and all data associated with it, including all cases and saved lines. This cannot be undone."
        confirmLabel="Delete my account"
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setModal(null)}
        busy={busy}
      />
    </div>
  );
}
