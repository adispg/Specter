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

function IconSpeaker({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function IconStop({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

/** Manages a single shared Audio instance for persona previews. */
function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<PersonaId | null>(null);
  const [loading, setLoading] = useState<PersonaId | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlaying(null);
  }, []);

  const preview = useCallback(async (persona: PersonaId) => {
    stop();
    if (available === false) return;

    setLoading(persona);
    try {
      const res = await fetch(`/api/tts/sample?persona=${encodeURIComponent(persona)}`);
      if (res.status === 501) {
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
      // silently fail
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
  const selectedTheme = themeVars(selectedPersona.theme) as CSSProperties;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wlc-root {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: env(safe-area-inset-top, 24px) 20px env(safe-area-inset-bottom, 40px);
          box-sizing: border-box;
          width: 100%;
          transition: --glow var(--dur-tint, 600ms) ease;
        }
        .wlc-inner {
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          animation: fadeUp 0.4s var(--ease-enter, cubic-bezier(0.16,1,0.3,1)) both;
        }
        /* Persona card */
        .wlc-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          border-radius: 18px;
          border: 1.5px solid var(--hair, rgba(255,255,255,0.08));
          background: var(--surface, #121722);
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color 0.22s, background 0.22s, box-shadow 0.22s;
          outline: none;
          box-sizing: border-box;
          overflow: hidden;
        }
        .wlc-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: radial-gradient(80% 80% at 20% 50%, var(--accent, #d3dbe8) 0%, transparent 70%);
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .wlc-card:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .wlc-card[aria-checked="true"] {
          border-color: color-mix(in srgb, var(--accent) 55%, transparent);
          background: color-mix(in srgb, var(--surface-2, #19202e) 85%, var(--accent) 15%);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent),
            0 6px 32px -6px color-mix(in srgb, var(--glow) 60%, transparent);
        }
        .wlc-card[aria-checked="true"]::before { opacity: 0.06; }
        .wlc-card[data-busy="true"] { cursor: default; opacity: 0.7; }
        /* Radio dot */
        .wlc-dot {
          width: 18px; height: 18px; flex: none;
          border-radius: 50%;
          border: 1.5px solid var(--hair-2, rgba(255,255,255,0.14));
          background: transparent;
          display: grid; place-items: center;
          margin-left: auto;
          transition: background 0.18s, border-color 0.18s;
        }
        .wlc-card[aria-checked="true"] .wlc-dot {
          background: var(--accent);
          border-color: var(--accent);
        }
        .wlc-dot-fill {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--bg, #090c12);
          opacity: 0;
          transition: opacity 0.14s;
        }
        .wlc-card[aria-checked="true"] .wlc-dot-fill { opacity: 1; }
        /* Voice button */
        .wlc-voice {
          flex-shrink: 0;
          display: grid; place-items: center;
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 1px solid var(--hair-2, rgba(255,255,255,0.14));
          background: transparent;
          color: var(--fg-3, #8b95a7);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          position: relative; z-index: 1;
        }
        .wlc-voice[data-playing="true"] {
          background: var(--accent);
          color: var(--on-accent, #0b0f16);
          border-color: var(--accent);
        }
        /* Section label */
        .wlc-section {
          font: 600 10.5px/1 var(--sans, system-ui);
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--fg-3, #8b95a7);
          margin: 0 0 10px 2px;
          align-self: flex-start;
        }
      `}</style>

      <main
        className="wlc-root"
        style={selectedTheme}
      >
        {/* Ambient glow layer */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(55% 40% at 50% -5%, var(--glow) 0%, transparent 70%)`,
            opacity: 0.7,
            transition: `opacity 0.6s, background 0.6s`,
            zIndex: 0,
          }}
        />

        <div className="wlc-inner" style={{ position: "relative", zIndex: 1, paddingTop: 20 }}>
          {/* Wordmark */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
            <Wordmark height={20} />
          </div>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h1
              style={{
                margin: "0 0 12px",
                font: `700 32px/1.06 var(--display, system-ui)`,
                letterSpacing: "-0.03em",
                color: "var(--fg)",
                textWrap: "balance",
              }}
            >
              {BRAND.promise}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--fg-3, #8b95a7)",
                maxWidth: 280,
                marginInline: "auto",
              }}
            >
              Pick an advisor. Describe what you are facing. Get the move.
            </p>
          </div>

          {/* Persona picker */}
          <p className="wlc-section">Your advisor</p>
          <div
            role="radiogroup"
            aria-label="Choose your advisor"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 28,
            }}
          >
            {personas.map((p) => {
              const isSelected = selected === p.id;
              const pConfig = PERSONAS[p.id];
              const pTheme = themeVars(pConfig.theme) as CSSProperties;
              const isPlaying = voice.playing === p.id;
              const isLoading = voice.loading === p.id;
              return (
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
                  style={isSelected ? pTheme : undefined}
                >
                  <Avatar persona={p.id} size="md" halo={isSelected ? 1 : 0} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                        marginBottom: 1,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 650,
                          fontSize: 14.5,
                          color: "var(--fg)",
                          lineHeight: 1.2,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {p.short}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: isSelected ? "var(--accent-2-text, var(--accent))" : "var(--fg-3, #8b95a7)",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          transition: "color 0.2s",
                        }}
                      >
                        {pConfig.archetype}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: "var(--fg-2, #cfd5df)",
                        lineHeight: 1.4,
                        opacity: isSelected ? 1 : 0.75,
                        transition: "opacity 0.2s",
                      }}
                    >
                      {pConfig.tagline}
                    </p>
                  </div>

                  {voice.available !== false && (
                    <button
                      type="button"
                      aria-label={isPlaying ? `Stop ${p.short}` : `Hear ${p.short}`}
                      disabled={busy || isLoading}
                      data-playing={isPlaying ? "true" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlaying) {
                          voice.stop();
                        } else {
                          setSelected(p.id);
                          void voice.preview(p.id);
                        }
                      }}
                      className="wlc-voice"
                    >
                      {isLoading
                        ? <Spinner size={11} marginRight={0} />
                        : isPlaying
                          ? <IconStop size={10} />
                          : <IconSpeaker size={13} />}
                    </button>
                  )}

                  <div className="wlc-dot" aria-hidden="true">
                    <span className="wlc-dot-fill" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 14 }}>
              <ErrorBanner>{error}</ErrorBanner>
            </div>
          )}

          {/* Disclosure */}
          <p
            style={{
              fontSize: 11.5,
              color: "var(--fg-3, #8b95a7)",
              textAlign: "center",
              lineHeight: 1.6,
              marginBottom: 14,
              maxWidth: 320,
              marginInline: "auto",
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
            style={{ width: "100%", fontSize: 15 }}
          >
            {busy && <Spinner />}
            {busy ? "Starting..." : "Get started"}
          </button>

          {/* Sign in link */}
          <p
            style={{
              margin: "18px 0 0",
              fontSize: 14,
              color: "var(--fg-3, #8b95a7)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Already have an account?{" "}
            <a
              href="/sign-in"
              style={{
                color: "var(--fg-2, #cfd5df)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Sign in
            </a>
          </p>
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
