"use client";
import { useMemo, type ReactNode } from "react";
import { metaText, PERSONAS, type PersonaId } from "@/lib/personas/config";
import { parseSpoken } from "@/lib/spoken";
import type { PerformanceView } from "@/lib/client/usePerformance";
import { SpokenText } from "./SpokenText";
import { IconBookmark, IconBookmarkFilled, IconPlay, IconShare, IconStop } from "./Icons";

export type LineCardData = { line: string; followup: string; principle?: string; hours?: number };

/** The line card (design-system.md 6.5): eyebrow, the line, the two-liner, mini player, save. */
export function LineCard({
  persona,
  data,
  perf,
  onPlay,
  saved,
  onToggleSave,
  onShare,
  sharing = false,
  thinking,
  compact = false,
  showFollowup = true,
  meta,
  children,
  testId = "line-card",
}: {
  persona: PersonaId;
  data: LineCardData;
  perf: PerformanceView;
  onPlay: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  /** Omitted where sharing is not offered, for example in care mode. */
  onShare?: () => void;
  sharing?: boolean;
  thinking?: ReactNode;
  compact?: boolean;
  showFollowup?: boolean;
  meta?: string;
  children?: ReactNode;
  testId?: string;
}) {
  const script = useMemo(() => parseSpoken(data.line, showFollowup ? data.followup : ""), [data.line, data.followup, showFollowup]);
  const performing = perf.active;
  const speaking = perf.state === "speaking" || perf.state === "pausing";
  const p = PERSONAS[persona];
  return (
    <article
      className={`take${compact ? " compact" : ""}${performing ? " performing" : ""}${speaking ? " speaking" : ""}${perf.state === "pausing" ? " pausing" : ""}`}
      aria-live="polite"
      data-testid={testId}
      data-voice-source={perf.active ? perf.source : undefined}
      data-state={perf.state}
    >
      {onToggleSave && (
        <button
          type="button"
          className="save"
          aria-pressed={saved ? "true" : "false"}
          aria-label={saved ? "Remove from saved lines" : "Save this line"}
          onClick={onToggleSave}
          data-testid="save-line"
        >
          {saved ? <IconBookmarkFilled /> : <IconBookmark />}
        </button>
      )}
      {onShare && (
        <button
          type="button"
          className={`shareline${onToggleSave ? "" : " only"}`}
          aria-label="Share this line"
          onClick={onShare}
          disabled={sharing}
          data-testid="share-line"
        >
          <IconShare />
        </button>
      )}
      {data.principle ? <p className="eyebrow">{data.principle}</p> : null}
      <SpokenText as="p" className="line" tokens={script.line} plain={data.line} progress={perf.progress} testId="the-line" />
      {showFollowup && data.followup ? (
        <SpokenText as="p" className="follow" tokens={script.followup} plain={data.followup} progress={perf.progress} testId="the-followup" />
      ) : null}
      <div className="player">
        <button
          type="button"
          className={`play${compact ? " sm" : ""}`}
          onClick={() => (performing ? perf.stop() : onPlay())}
          aria-label={performing ? "Stop" : "Hear it"}
          data-testid="play"
        >
          {performing ? <IconStop /> : <IconPlay />}
        </button>
        <div className="wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="beat" aria-hidden="true">
          Pause
        </span>
        <span className="meta">{meta ?? metaText(p, data.hours)}</span>
      </div>
      {children}
      {thinking}
    </article>
  );
}

export function ThinkingOverlay({ persona, onStop, line }: { persona: PersonaId; onStop?: () => void; line: string }) {
  const p = PERSONAS[persona];
  return (
    <div className="thinking" data-testid="thinking">
      <div>
        <p>{line}</p>
        <div className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          {p.short} is on it
        </p>
        {onStop && (
          <button type="button" className="btn ghost sm" style={{ marginTop: 14, height: 34 }} onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
