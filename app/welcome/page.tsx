"use client";
import { Suspense, useState } from "react";
import { BRAND, PERSONAS, personaList, type PersonaId } from "@/lib/personas/config";
import { Wordmark } from "@/components/Wordmark";
import { Avatar } from "@/components/Persona";
import { ErrorBanner } from "@/components/ui";

const PERSONA_PITCHES: Record<PersonaId, string> = {
  closer: "Reads the room. Moves first. Already three steps ahead.",
  prodigy: "Finds the angle nobody else sees. Wins on facts, not force.",
  insider: "Knows who matters and what they actually want.",
};

function WelcomeInner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ageConfirmed: true, disclosureAck: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Something went wrong. Try again.");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px 60px",
        background: "var(--bg)",
        boxSizing: "border-box",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <Wordmark />

      <p
        style={{
          marginTop: 12,
          marginBottom: 40,
          color: "var(--fg-2)",
          fontSize: 16,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {BRAND.promise}
      </p>

      <div
        role="list"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
          marginBottom: 40,
        }}
      >
        {personaList().map((p) => (
          <div
            key={p.id}
            role="listitem"
            data-persona={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <Avatar persona={p.id} size="lg" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginBottom: 2 }}>
                {p.short}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.4 }}>
                {PERSONA_PITCHES[p.id]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ width: "100%", marginBottom: 16 }}>
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      <p
        style={{
          fontSize: 11,
          color: "var(--fg-3)",
          textAlign: "center",
          lineHeight: 1.5,
          marginBottom: 16,
          maxWidth: 320,
        }}
      >
        By continuing you confirm you are 18 or older and understand this app uses AI.
        Advice is for perspective only, not professional counsel.
      </p>

      <button
        type="button"
        className="cta"
        onClick={handleTry}
        disabled={busy}
        style={{ width: "100%", maxWidth: 320 }}
      >
        {busy ? "Starting..." : "Try it free"}
      </button>

      <a
        href="/sign-in"
        style={{
          marginTop: 16,
          fontSize: 14,
          color: "var(--fg-2)",
          textDecoration: "none",
          padding: 8,
        }}
      >
        Already have an account? Sign in
      </a>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeInner />
    </Suspense>
  );
}
