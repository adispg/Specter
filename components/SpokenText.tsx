import { Fragment, type ReactNode } from "react";
import { stripMarks, type SpokenToken } from "@/lib/spoken";
import type { Progress } from "@/lib/client/performer";

/**
 * Renders words and pause marks for lighting. Word spans are aria-hidden and a
 * visually hidden copy holds the plain text, so screen readers read it once.
 * The word before each mark and the mark share a nowrap span, so a mark never
 * starts a line.
 */
export function SpokenText({
  tokens,
  plain,
  progress,
  as: Tag = "p",
  className,
  testId,
}: {
  tokens: SpokenToken[];
  plain: string;
  progress: Progress;
  as?: "p" | "h2" | "div";
  className?: string;
  testId?: string;
}) {
  const parts: ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === "pause") {
      if (t.hidden) continue;
      parts.push(<PauseMark key={`p${t.pauseIndex}`} len={t.len} on={progress.activePause === t.pauseIndex} />);
      continue;
    }
    const next = tokens[i + 1];
    const word = (
      <span className={`w${progress.wordsLit > t.wordIndex ? " lit" : ""}`} data-w={t.wordIndex}>
        {t.text}
      </span>
    );
    if (next && next.type === "pause" && !next.hidden) {
      parts.push(
        <span className="nb" key={`w${t.wordIndex}`}>
          {word}
          <PauseMark len={next.len} on={progress.activePause === next.pauseIndex} />
        </span>,
      );
      i++;
    } else {
      parts.push(<Fragment key={`w${t.wordIndex}`}>{word}</Fragment>);
    }
    parts.push(" ");
  }
  return (
    <Tag className={className} data-testid={testId}>
      <span className="sr-only">{stripMarks(plain)}</span>
      <span aria-hidden="true">{parts}</span>
    </Tag>
  );
}

function PauseMark({ len, on }: { len: "short" | "long"; on: boolean }) {
  return (
    <span className={`pause${on ? " on" : ""}`} data-len={len} data-testid="pause-mark">
      <i />
      {len === "long" && <i />}
    </span>
  );
}
