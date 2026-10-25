"use client";
/**
 * Voice mode (screens.md 7): full-screen dialog over whatever launched it.
 * States: listening, thinking, speaking. Opens from ResultView (first reply)
 * and from the thread (follow-ups).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PERSONAS, type PersonaId } from "@/lib/personas/config";
import { useApp } from "./AppProvider";
import { Avatar } from "./Persona";
import { IconClose, IconKbd, IconStop, IconPause, IconPlay } from "./Icons";
import { startDictation, type DictationSession } from "@/lib/client/dictation";
import { useConsult } from "@/lib/client/useConsult";
import { usePerformance } from "@/lib/client/usePerformance";
import { SpokenText } from "./SpokenText";
import { parseSpoken } from "@/lib/spoken";
import type { ConsultResponse } from "@/lib/client/api";

type VoiceState = "listening" | "thinking" | "speaking" | "error" | "denied";

export type VoiceModeProps = {
  persona: PersonaId;
  caseId: string;
  /** For follow-ups from the thread: the text that launched voice mode. Unused for initial. */
  prefill?: string;
  onClose: () => void;
  /** Called after a successful reply finishes (or the user taps "See the full answer"). */
  onFinished: () => void;
};

export function VoiceMode({ persona, caseId, onClose, onFinished }: VoiceModeProps) {
  const { settings, config, toast, online } = useApp();
  const p = PERSONAS[persona];
  const [phase, setPhase] = useState<VoiceState>("listening");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<ConsultResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dictRef = useRef<DictationSession | null>(null);
  const consult = useConsult();
  const perf = usePerformance(`voice-${caseId}`);
  const levelRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thinking copy cycles.
  const thinkingCopy = p.thinking;
  const [thinkIdx, setThinkIdx] = useState(0);
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setInterval(() => setThinkIdx((i) => (i + 1) % thinkingCopy.length), 2200);
    return () => clearInterval(t);
  }, [phase, thinkingCopy.length]);

  const stopDictation = useCallback(() => {
    dictRef.current?.stop();
    dictRef.current = null;
  }, []);

  const cancelDictation = useCallback(() => {
    dictRef.current?.cancel();
    dictRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    setPhase("listening");
    setTranscript("");
    setInterim("");
    setLevel(0);
    const session = startDictation(
      {
        onText(final, int) {
          setTranscript(final);
          setInterim(int);
        },
        onLevel(l) {
          setLevel(l);
          if (levelRef.current) clearTimeout(levelRef.current);
          levelRef.current = setTimeout(() => setLevel(0), 200);
        },
        onState(s) {
          if (s === "transcribing") setPhase("thinking");
        },
        onEnd(text) {
          if (!text.trim()) {
            toast("Didn't catch that. Try again.");
            onClose();
            return;
          }
          void runConsult(text);
        },
        onError(e) {
          if (e === "denied") {
            setPhase("denied");
          } else if (e === "no-speech") {
            toast("Didn't catch that. Try again.");
            onClose();
          } else if (e === "unsupported") {
            toast("Voice isn't available in this browser. Type it instead.");
            onClose();
          } else {
            setPhase("error");
            setErrorMsg("Something went wrong with the microphone.");
          }
        },
      },
      { sttEnabled: config.sttEnabled },
    );
    dictRef.current = session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sttEnabled]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runConsult = useCallback(
    async (text: string) => {
      setPhase("thinking");
      const res = await consult.run({
        action: "followup",
        caseId,
        persona,
        intensity: settings.intensity,
        text: text.trim(),
      });
      if (!res) {
        // consult hook already routed to error / limit
        onClose();
        return;
      }
      if (res.consult.mode === "care") {
        onFinished();
        return;
      }
      setResult(res);
      setPhase("speaking");
      const speakReq = {
        persona: res.consult.persona,
        line: res.consult.reply.line,
        followup: res.consult.reply.followup,
        care: false,
        pace: settings.pace,
        tts: config.ttsEnabled ? { consultId: res.consult.id, readPlay: settings.readPlay } : null,
        browserVoice: null,
      };
      const r = await perf.play(speakReq);
      if (r === "done") {
        onFinished();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseId, persona, settings, config, consult, perf, onClose, onFinished],
  );

  useEffect(() => {
    startListening();
    return () => {
      cancelDictation();
      perf.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (phase === "listening") {
      stopDictation();
    } else if (phase === "speaking") {
      perf.stop();
      onClose();
    }
  };

  const script = result ? parseSpoken(result.consult.reply.line, result.consult.reply.followup) : null;

  const stateLabel =
    phase === "listening"
      ? "Listening"
      : phase === "thinking"
        ? `${p.short} is on it`
        : phase === "speaking"
          ? "Speaking"
          : phase === "denied"
            ? "Mic off"
            : "Something went wrong";

  return (
    <div className="voice-mode" role="dialog" aria-modal aria-label="Voice mode" data-phase={phase}>
      {/* Top row */}
      <div className="vm-topbar">
        <button type="button" className="ib" aria-label="Close voice mode" onClick={() => { cancelDictation(); perf.stop(); onClose(); }}>
          <IconClose />
        </button>
        <span className="vm-chip">
          <Avatar persona={persona} size="sm" />
          <span>{p.short}</span>
        </span>
        <button type="button" className="ib" aria-label="Switch to keyboard" onClick={() => { cancelDictation(); perf.stop(); onClose(); }}>
          <IconKbd />
        </button>
      </div>

      {/* Avatar */}
      <div className="vm-hero">
        <Avatar persona={persona} size="xxl" halo={phase === "speaking" ? 1 : undefined} />
        <p className="overline vm-state">{stateLabel}</p>
      </div>

      {/* Text area */}
      <div className="vm-text" aria-live="polite">
        {phase === "listening" && (
          <div className="vm-transcript">
            {transcript ? (
              <span>{transcript} <span style={{ opacity: 0.5 }}>{interim}</span></span>
            ) : (
              <span style={{ opacity: 0.45 }}>Go ahead. What happened?</span>
            )}
          </div>
        )}
        {phase === "thinking" && (
          <div className="vm-thinking">
            <p className="small vm-echo">{transcript || "You"}</p>
            <p className="t2">{thinkingCopy[thinkIdx]}</p>
            <p className="small" style={{ opacity: 0.55 }}>{p.short} is on it</p>
          </div>
        )}
        {phase === "speaking" && result && script && (
          <div className="vm-speaking">
            {result.consult.reply.principle && (
              <p className="overline" style={{ opacity: 0.6, marginBottom: 4 }}>{result.consult.reply.principle}</p>
            )}
            <SpokenText
              tokens={script.line}
              plain={result.consult.reply.line}
              progress={perf.progress}
              as="p"
              className="display-voice"
              testId="voice-line"
            />
          </div>
        )}
        {phase === "denied" && (
          <div className="vm-denied">
            <p className="t2">Your mic is off.</p>
            <button type="button" className="btn fill" onClick={() => { perf.stop(); onClose(); }}>
              Type instead
            </button>
          </div>
        )}
        {phase === "error" && (
          <div className="vm-denied">
            <p className="t2">{errorMsg ?? "Something went wrong."}</p>
            <button type="button" className="btn fill" onClick={startListening}>
              Try again
            </button>
            <button type="button" className="btn ghost" onClick={() => { perf.stop(); onClose(); }}>
              Type instead
            </button>
          </div>
        )}
      </div>

      {/* Waveform / level meter */}
      {phase === "listening" && (
        <div className="vm-wave" aria-hidden>
          <div className="vm-level" style={{ "--lv": level } as React.CSSProperties} />
        </div>
      )}

      {/* Controls */}
      <div className="vm-controls">
        {phase === "listening" && (
          <>
            <p className="small vm-hint">Tap again when you&apos;re done.</p>
            <button type="button" className="vm-ctl" aria-label="Stop listening" onClick={handleTap}>
              <IconStop />
            </button>
            <button type="button" className="btn ghost" onClick={() => { cancelDictation(); onClose(); }}>
              Cancel
            </button>
          </>
        )}
        {phase === "thinking" && (
          <button type="button" className="btn ghost" onClick={() => { consult.stop(); onClose(); }}>
            Stop
          </button>
        )}
        {phase === "speaking" && (
          <>
            <p className="small vm-hint">Tap anywhere to interrupt</p>
            <button type="button" className="vm-ctl" aria-label={perf.state === "pausing" ? "Resume" : "Pause"} onClick={() => perf.state === "pausing" ? perf.play({ persona, line: result?.consult.reply.line ?? "", followup: result?.consult.reply.followup ?? "", care: false, pace: settings.pace, tts: null, browserVoice: null }) : perf.stop()}>
              {perf.state === "pausing" ? <IconPlay /> : <IconPause />}
            </button>
            <button
              type="button"
              className="textbtn"
              onClick={() => { perf.stop(); onFinished(); }}
            >
              See the full answer
            </button>
          </>
        )}
      </div>

      {/* Offline guard */}
      {!online && (
        <div className="vm-offline-msg" role="alert">
          Voice needs a connection.
        </div>
      )}
    </div>
  );
}
