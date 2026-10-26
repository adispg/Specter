"use client";
import { useCallback, useEffect, useState } from "react";
import { PERSONAS, personaList, type PersonaId } from "@/lib/personas/config";
import { browserVoices, pickBrowserVoice, voicesReady } from "@/lib/client/performer";
import { useApp } from "./AppProvider";
import { Avatar } from "./Persona";

/**
 * Per persona device voice choice.
 *
 * The automatic pick scores voice names, which works on Windows and macOS but
 * not on Android, where Google's voices are named like "en-us-x-tpf-local" and
 * carry no gender word. Rather than keep guessing at heuristics, this lets the
 * listener choose and hear the result. An explicit choice always wins over the
 * automatic pick.
 */
export function VoicePicker() {
  const { browserVoice, setBrowserVoice } = useApp();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<PersonaId | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // The list arrives asynchronously; reading it synchronously returns [].
    voicesReady().then(() => {
      if (!live) return;
      setVoices(browserVoices());
      setReady(true);
    });
    return () => {
      live = false;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Nothing to cancel.
      }
    };
  }, []);

  const sample = useCallback((persona: PersonaId, voice: SpeechSynthesisVoice | null) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const p = PERSONAS[persona];
      const u = new SpeechSynthesisUtterance("Bring me the situation. I will tell you how it ends.");
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = p.voice.browser.rate;
      u.pitch = p.voice.browser.pitch;
      u.onend = () => setSpeaking(null);
      u.onerror = () => setSpeaking(null);
      setSpeaking(`${persona}:${voice?.name ?? "auto"}`);
      synth.speak(u);
    } catch {
      setSpeaking(null);
    }
  }, []);

  if (!ready) return <p className="fine" style={{ padding: "8px 16px" }}>Loading the voices on this device.</p>;

  if (!voices.length) {
    return (
      <p className="fine" style={{ padding: "8px 16px" }}>
        This device reports no English speech voices, so spoken replies will use whatever the browser
        defaults to. Installing a text to speech voice in your system settings will give you a choice here.
      </p>
    );
  }

  return (
    <div>
      {personaList().map((p) => {
        const chosenName = browserVoice(p.id);
        const auto = pickBrowserVoice(p.id, null);
        const current = chosenName ? (voices.find((v) => v.name === chosenName) ?? null) : auto;
        const isOpen = open === p.id;
        return (
          <div key={p.id} style={{ borderBottom: "1px solid var(--hair)" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.id)}
              aria-expanded={isOpen}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 16px", background: "none", border: 0, textAlign: "left", cursor: "pointer",
              }}
            >
              <Avatar persona={p.id} size="sm" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, color: "var(--fg)" }}>{p.short}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {current ? current.name : "Browser default"}
                  {!chosenName && current ? " (chosen automatically)" : ""}
                </span>
              </span>
              <span aria-hidden="true" style={{ color: "var(--muted)", fontSize: 13 }}>{isOpen ? "Close" : "Change"}</span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                <button
                  type="button"
                  className="starter"
                  style={{ marginBottom: 6, borderLeftColor: chosenName ? "var(--hair-2)" : "var(--accent-2)" }}
                  onClick={() => {
                    setBrowserVoice(p.id, null);
                    sample(p.id, auto);
                  }}
                >
                  Choose automatically{auto ? `, currently ${auto.name}` : ""}
                </button>
                {voices.map((v) => {
                  const selected = chosenName === v.name;
                  return (
                    <div key={v.name} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <button
                        type="button"
                        className="starter"
                        style={{ borderLeftColor: selected ? "var(--accent-2)" : "var(--hair-2)" }}
                        onClick={() => {
                          setBrowserVoice(p.id, v.name);
                          sample(p.id, v);
                        }}
                      >
                        {v.name}
                        <span style={{ color: "var(--muted)", fontSize: 12 }}> {v.lang}</span>
                      </button>
                      <button
                        type="button"
                        className="soft"
                        aria-label={`Hear ${v.name}`}
                        style={{ flex: "none", padding: "0 12px" }}
                        onClick={() => sample(p.id, v)}
                      >
                        {speaking === `${p.id}:${v.name}` ? "..." : "Hear"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
