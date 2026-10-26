"use client";
import { Suspense, useState } from "react";
import { BRAND, personaList, type PersonaId } from "@/lib/personas/config";
import { Wordmark } from "@/components/Wordmark";
import { Avatar } from "@/components/Persona";
import { ErrorBanner } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const PERSONA_PITCHES: Record<PersonaId, string> = {
  closer: "Reads the room. Moves first. Already three steps ahead.",
  prodigy: "Finds the angle nobody else sees. Wins on facts, not force.",
  insider: "Knows who matters and what they actually want.",
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
        marginRight: 8,
      }}
    />
  );
}

function WelcomeInner() {
  const personas = personaList();
  const [selected, setSelected] = useState<PersonaId>(personas[0]?.id ?? "closer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Sign in anonymously from the browser so the Supabase session cookies are
      // written by the browser itself. Signing in inside the route handler created
      // the user server-side but the Set-Cookie never reached the browser, so the
      // middleware saw no session and bounced straight back here.
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anonKey) {
        const sb = createSupabaseBrowserClient(url, anonKey);
        const { data: current } = await sb.auth.getSession();
        if (!current.session) {
          const { error: signInError } = await sb.auth.signInAnonymously();
          if (signInError) throw new Error("Guest mode is unavailable. Sign in to continue.");
        }
      }

      // Records the 18+ and AI disclosure acknowledgements against the session
      // the browser just established, so the app layout lets us through.
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ageConfirmed: true, disclosureAck: true, persona: selected }),
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
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
            marginBottom: 32,
            color: "var(--fg-2)",
            fontSize: 16,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {BRAND.promise}
        </p>

        <div
          role="radiogroup"
          aria-label="Choose your advisor"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            marginBottom: 32,
          }}
        >
          {personas.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(p.id)}
                disabled={busy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--hair)",
                  background: isSelected ? "var(--surface)" : "var(--surface)",
                  cursor: busy ? "default" : "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.15s, background 0.15s",
                  outline: "none",
                }}
              >
                <Avatar persona={p.id} size="lg" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg)", marginBottom: 2 }}>
                    {p.short}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.4 }}>
                    {PERSONA_PITCHES[p.id]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ width: "100%", marginBottom: 16 }}>
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            color: "var(--muted)",
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
          className="btn primary"
          onClick={handleTry}
          disabled={busy}
          style={{ width: "100%", maxWidth: 320 }}
        >
          {busy && <Spinner />}
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
    </>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeInner />
    </Suspense>
  );
}
