"use client";
import Link from "next/link";
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
import { IconSettings } from "@/components/Icons";
import { useConsult } from "@/lib/client/useConsult";
import { dictationSupported, startDictation, type DictationSession } from "@/lib/client/dictation";

export function HomeScreen() {
  const { persona, setPersona, settings, config, toast } = useApp();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  // Set on send and never cleared on success, so the empty state cannot come
  // back for a frame between the reply arriving and the route changing.
  const [leaving, setLeaving] = useState(false);
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
  // The persona header stays while they type: hiding it on the first keystroke
  // emptied the whole screen to black with only the composer left, which is
  // worse than the dead space it was meant to avoid. Only the starters step
  // aside, since they have served their purpose once there is text.
  const working = consult.busy || leaving;
  const showHeader = !working;
  const showStarters = !text.trim() && !working && !listening;

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
    setLeaving(true);
    const res = await consult.run({
      action: "new",
      persona,
      intensity: settings.intensity,
      situation,
    });
    if (res) {
      // Stays true through the navigation. Clearing it here would drop the
      // screen back to its empty state for a frame before the route changes,
      // which read as the home page flashing back before the answer.
      router.push(`/cases/${res.caseId}`);
    } else {
      setLeaving(false);
      // Failed: give the situation back so it is not lost.
      setText((current) => (current ? current : situation));
    }
  }

  return (
    <div className="scr">
      <div className="topbar">
        <PersonaRail value={persona} onChange={setPersona} />
        <IntensityControl />
        {/* Settings had no link anywhere in the app, so the voice picker, the
            account section and sign out were reachable only by typing the URL. */}
        <Link href="/settings" className="iconbtn" aria-label="Settings">
          <IconSettings />
        </Link>
      </div>

      <main className="body home stack">
        <OfflineBanner />
        {consult.error && (
          <ErrorBanner onRetry={consult.retry}>{consult.error}</ErrorBanner>
        )}
        {showHeader && (
          <div className="deskhead">
            <Avatar persona={persona} size="xl" />
            <h1 className="nm">{p.name}</h1>
            <p className="rl">{p.role}</p>
            <p className="sy">{spoken(p.emptyStates.home)}</p>
          </div>
        )}

        {working && (
          <p className="thinking" aria-live="polite">
            {p.thinking[0] ?? "Working on it."}
          </p>
        )}

        {showStarters && (
          <>

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
