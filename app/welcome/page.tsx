"use client";
import { Suspense, useCallback, useRef, useState, type CSSProperties } from "react";
import { BRAND, PERSONAS, personaList, themeVars, type PersonaId } from "@/lib/personas/config";
import { Wordmark } from "@/components/Wordmark";
import { Avatar } from "@/components/Persona";
import { ErrorBanner } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function Spinner({ size = 15, marginRight = 8 }: { size?: number; marginRight?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
        marginRight,
        opacity: 0.8,
      }}
    />
  );
}

/** Speaker icon for the voice preview button. */
function IconSpeaker() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

/** Manages a single shared Audio instance for persona previews. */
function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<PersonaId | null>(null);
  const [loading, setLoading] = useState<PersonaId | null>(null);
  // null = not yet tried, true = works, false = unavailable
  const [available, setAvailable] = useState<boolean | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlaying(null);
  }, []);

  const preview = useCallback(async (persona: PersonaId) => {
    // Stop whatever is playing
    stop();
    // If we already know TTS is unavailable, do nothing
    if (available === false) return;

    setLoading(persona);
    try {
      const res = await fetch(`/api/tts/sample?persona=${encodeURIComponent(persona)}`);
      if (res.status === 501) {
        // TTS not configured on this deployment
        setAvailable(false);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { audio?: string; mime?: string };
      if (!data.audio || !data.mime) return;
      setAvailable(true);
      const src = `data:${data.mime};base64,${data.audio}`;
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setPlaying(null);
      audio.onerror = () => setPlaying(null);
      setPlaying(persona);
      void audio.play();
    } catch {
      // Network or parse error -- silently fail
    } finally {
      setLoading(null);
    }
  }, [available, stop]);

  return { playing, loading, available, preview, stop };
}

function WelcomeInner() {
  const personas = personaList();
  const [selected, setSelected] = useState<PersonaId>(personas[0]?.id ?? "closer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoicePreview();

  async function handleTry() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
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

  const selectedPersona = PERSONAS[selected];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .wlc-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: var(--radius-xl, 18px);
          border: 1.5px solid var(--hair, rgba(255,255,255,0.08));
          background: var(--surface);
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          outline: none;
          position: relative;
          box-sizing: border-box;
        }
        .wlc-card:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .wlc-card[aria-checked="true"] {
          background: var(--surface-2, #19202e);
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent), 0 4px 24px -8px color-mix(in srgb, var(--accent) 40%, transparent);
        }
        .wlc-card[data-busy="true"] { cursor: default; opacity: 0.7; }
        .wlc-check {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1.5px solid var(--hair, rgba(255,255,255,0.12));
          background: transparent;
          flex: none;
          display: grid;
          place-items: center;
          transition: background 0.15s, border-color 0.15s;
          margin-left: auto;
        }
        .wlc-card[aria-checked="true"] .wlc-check {
          background: var(--accent);
          border-color: var(--accent);
        }
        .wlc-check-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--bg);
          opacity: 0;
          transition: opacity 0.12s;
        }
        .wlc-card[aria-checked="true"] .wlc-check-dot { opacity: 1; }
      `}</style>

      <main
        style={{
          ...(themeVars(selectedPersona.theme) as CSSProperties),
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "env(safe-area-inset-top, 24px) 24px env(safe-area-inset-bottom, 40px)",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Wordmark */}
          <Wordmark height={22} />

          {/* Promise */}
          <p
            style={{
              margin: "10px 0 36px",
              color: "var(--muted)",
              fontSize: 14,
              textAlign: "center",
              lineHeight: 1.5,
              letterSpacing: "0.01em",
            }}
          >
            {BRAND.promise}
          </p>

          {/* Persona picker */}
          <p
            style={{
              margin: "0 0 12px 2px",
              color: "var(--fg-2)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              alignSelf: "flex-start",
            }}
          >
            Choose your advisor
          </p>

          <div
            role="radiogroup"
            aria-label="Choose your advisor"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
              marginBottom: 28,
            }}
          >
            {personas.map((p) => {
              const isSelected = selected === p.id;
              const pConfig = PERSONAS[p.id];
              const isPlaying = voice.playing === p.id;
              const isLoading = voice.loading === p.id;
              return (
                /* Outer div acts as the radio card. A nested button (speaker)
                   would be invalid HTML inside a <button>, so the card is a
                   keyboard-accessible div with role="radio". */
                <div
                  key={p.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={busy ? -1 : 0}
                  data-busy={busy ? "true" : undefined}
                  onClick={() => !busy && setSelected(p.id)}
                  onKeyDown={(e) => {
                    if (!busy && (e.key === " " || e.key === "Enter")) {
                      e.preventDefault();
                      setSelected(p.id);
                    }
                  }}
                  className="wlc-card"
                  style={isSelected ? (themeVars(pConfig.theme) as CSSProperties) : undefined}
                >
                  <Avatar persona={p.id} size="lg" halo={isSelected ? 1 : 0} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--fg)", lineHeight: 1.2 }}>
                        {p.short}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: isSelected ? "var(--accent)" : "var(--muted)",
                          fontWeight: 500,
                          letterSpacing: "0.02em",
                          transition: "color 0.18s",
                        }}
                      >
                        {pConfig.archetype}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--fg-2)",
                        lineHeight: 1.45,
                      }}
                    >
                      {pConfig.tagline}
                    </p>
                  </div>
                  {voice.available !== false && (
                    <button
                      type="button"
                      aria-label={isPlaying ? `Stop ${p.short}'s voice` : `Hear ${p.short}'s voice`}
                      disabled={busy || isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlaying) {
                          voice.stop();
                        } else {
                          setSelected(p.id);
                          void voice.preview(p.id);
                        }
                      }}
                      style={{
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        border: "1px solid var(--hair, rgba(255,255,255,0.12))",
                        background: isPlaying ? "var(--accent)" : "transparent",
                        color: isPlaying ? "var(--bg)" : "var(--fg-3)",
                        cursor: "pointer",
                        transition: "background 0.15s, color 0.15s",
                        marginRight: 6,
                      }}
                    >
                      {isLoading
                        ? <Spinner size={12} marginRight={0} />
                        : <IconSpeaker />}
                    </button>
                  )}
                  <div className="wlc-check" aria-hidden="true">
                    <span className="wlc-check-dot" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ width: "100%", marginBottom: 14 }}>
              <ErrorBanner>{error}</ErrorBanner>
            </div>
          )}

          {/* Disclosure */}
          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              textAlign: "center",
              lineHeight: 1.6,
              marginBottom: 14,
              maxWidth: 340,
            }}
          >
            By continuing you confirm you are 18 or older and understand this app uses AI.
            Advice is for perspective only, not professional counsel.
          </p>

          {/* CTA */}
          <button
            type="button"
            className="cta"
            onClick={() => { voice.stop(); void handleTry(); }}
            disabled={busy}
            style={{ width: "100%" }}
          >
            {busy && <Spinner />}
            {busy ? "Starting..." : "Get started"}
          </button>

          {/* Sign in link */}
          <a
            href="/sign-in"
            style={{
              marginTop: 18,
              fontSize: 14,
              color: "var(--muted)",
              textDecoration: "none",
              padding: "8px 0",
            }}
          >
            Already have an account?{" "}
            <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>Sign in</span>
          </a>
        </div>
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
