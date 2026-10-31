"use client";
import { useCallback, useEffect, useState } from "react";
import { performer, type PerformRequest, type PerformResult, type PerformState, type Progress, type TtsFallbackReason, type VoiceSource } from "./performer";

export type PerformanceView = {
  state: PerformState;
  progress: Progress;
  source: VoiceSource;
  /** Set when server TTS failed and browser speech was used instead. */
  ttsFallback: TtsFallbackReason;
  /** True while this key is the one being performed. */
  active: boolean;
  play: (req: PerformRequest) => Promise<PerformResult>;
  stop: () => void;
};

/** Subscribe a card to the shared performer; only the card whose key is playing lights up. */
export function usePerformance(key: string): PerformanceView {
  const p = performer();
  const [snap, setSnap] = useState(() => ({ state: p.state, progress: p.progress, source: p.source, ttsFallback: p.ttsFallback, current: p.currentKey }));
  useEffect(
    () =>
      p.subscribe((s) => {
        setSnap({ state: s.state, progress: s.progress, source: s.source, ttsFallback: s.ttsFallback, current: p.currentKey });
      }),
    [p],
  );
  const active = snap.current === key && snap.state !== "idle";
  const play = useCallback((req: PerformRequest) => p.perform(key, req), [p, key]);
  const stop = useCallback(() => p.stop(), [p]);
  return {
    state: active ? snap.state : "idle",
    progress: active ? snap.progress : { wordsLit: 0, activePause: null },
    source: snap.source,
    ttsFallback: snap.ttsFallback,
    active,
    play,
    stop,
  };
}
