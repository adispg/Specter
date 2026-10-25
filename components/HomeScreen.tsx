"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { personaPlaceholder, useApp } from "@/components/AppProvider";
import { PERSONAS, PERSONA_STARTERS } from "@/lib/personas/config";
import { Avatar } from "@/components/Persona";

/** Persona copy carries "|" and "||" speech pause markers for the voice engine. */
function spoken(s: string): string {
  return s.replace(/\|\|/g, " ").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}
import { TabBar, PersonaRail, Composer, IntensityControl, OfflineBanner, ErrorBanner } from "@/components/ui";
import { useConsult } from "@/lib/client/useConsult";
import { dictationSupported, startDictation, type DictationSession } from "@/lib/client/dictation";

export function HomeScreen() {
  const { persona, setPersona, settings, config, toast } = useApp();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const consult = useConsult();
  const router = useRouter();
  const dictRef = useRef<DictationSession | null>(null);
  // Text captured before dictation started, so a transcript appends rather
  // than wiping anything already typed.
  const baseRef = useRef("");

  // Resolved after mount: dictationSupported reads window, so deciding during
  // render would disagree with the server HTML and break hydration.
  const [micAvailable, setMicAvailable] = useState(false);
  useEffect(() => {
    setMicAvailable(dictationSupported(config.sttEnabled));
  }, [config.sttEnabled]);

  useEffect(() => () => dictRef.current?.cancel(), []);

  const p = PERSONAS[persona];
  // The desk head and starters are the empty state: they step aside as soon as
  // there is something to send.
  const idle = !text.trim() && !consult.busy && !listening;

  const toggleMic = useCallback(() => {
    if (dictRef.current) {
      dictRef.current.stop();
      return;
    }
    baseRef.current = text.trim();
    setListening(true);
    dictRef.current = startDictation(
      {
        onText: (final, interim) => {
          const join = [baseRef.current, (final + " " + interim).trim()].filter(Boolean).join(" ");
          setText(join);
        },
        onEnd: (final) => {
          dictRef.current = null;
          setListening(false);
          const join = [baseRef.current, final.trim()].filter(Boolean).join(" ");
          setText(join);
        },
        onError: (e) => {
          dictRef.current = null;
          setListening(false);
          toast(
            e === "denied"
              ? "Microphone access is off. Turn it on in your browser settings."
              : e === "no-speech"
                ? "Didn't catch that. Try again."
                : "Voice input isn't available here. Type instead.",
          );
        },
      },
      { sttEnabled: config.sttEnabled },
    );
  }, [text, config.sttEnabled, toast]);

  async function submit() {
    const situation = text.trim();
    if (!situation) return;
    if (dictRef.current) {
      dictRef.current.cancel();
      dictRef.current = null;
      setListening(false);
    }
    // Clear immediately. The model can take ten seconds or more, and leaving the
    // text sitting in the box makes it look like the send never registered.
    setText("");
    const res = await consult.run({
      action: "new",
      persona,
      intensity: settings.intensity,
      situation,
    });
    if (res) {
      router.push(`/cases/${res.caseId}`);
    } else {
      // Failed: give the situation back so it is not lost.
      setText((current) => (current ? current : situation));
    }
  }

  return (
    <div className="scr">
      <div className="topbar">
        <PersonaRail value={persona} onChange={setPersona} />
        <IntensityControl />
      </div>

      <main className="body home stack">
        <OfflineBanner />
        {consult.error && (
          <ErrorBanner onRetry={consult.retry}>{consult.error}</ErrorBanner>
        )}
        {idle && (
          <>
            <div className="deskhead">
              <Avatar persona={persona} size="xl" />
              <h1 className="nm">{p.name}</h1>
              <p className="rl">{p.role}</p>
              <p className="sy">{spoken(p.emptyStates.home)}</p>
            </div>

            <div className="starters">
              <div className="rule" />
              {PERSONA_STARTERS[persona].map((s) => (
                <button key={s} type="button" className="starter" onClick={() => setText(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <Composer
        value={text}
        onChange={setText}
        onSubmit={submit}
        placeholder={personaPlaceholder(persona, false)}
        busy={consult.busy}
        onStop={consult.stop}
        listening={listening}
        {...(micAvailable ? { onMic: toggleMic } : {})}
        autoFocus
      />

      <TabBar />
    </div>
  );
}
