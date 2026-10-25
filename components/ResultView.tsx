"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRAND, PERSONAS, personaList, themeVars, type PersonaId, type RegionHelp } from "@/lib/personas/config";
import type { CaseRow, ConsultRow } from "@/lib/data/types";
import { stripMarks } from "@/lib/spoken";
import { api } from "@/lib/client/api";
import { setPending } from "@/lib/client/pending";
import { usePerformance } from "@/lib/client/usePerformance";
import { personaPlaceholder, useApp } from "./AppProvider";
import { Avatar } from "./Persona";
import { CareView } from "./CareView";
import { LineCard } from "./LineCard";
import { FeedbackRow, MomentRow } from "./ResultExtras";
import { AdviceCards, Composer, ErrorBanner, OfflineBanner, Sheet, copyText } from "./ui";
import { IconBack, IconMore, IconPush, IconRedo, IconReplay } from "./Icons";
import { VoiceMode } from "./VoiceMode";

export type ResultProps = {
  caseRow: CaseRow;
  consults: ConsultRow[];
  savedIds: string[];
  feedback: Record<string, "up" | "down">;
  help: RegionHelp;
  autoSpeak: boolean;
};

export function useSpeakConsult() {
  const { settings, config, browserVoice } = useApp();
  return (c: ConsultRow) => ({
    persona: c.persona,
    line: c.reply.line,
    followup: c.reply.followup,
    care: c.mode === "care",
    pace: settings.pace,
    tts: config.ttsEnabled ? { consultId: c.id, readPlay: settings.readPlay } : null,
    browserVoice: browserVoice(c.persona),
  });
}

export function copyLineText(c: ConsultRow): string {
  const p = PERSONAS[c.persona];
  return `${stripMarks(c.reply.line)} ${stripMarks(c.reply.followup)} (${p.short})`.replace(/\s+/g, " ").trim();
}

/** Consult result (screens.md 8): the first reply of a case. Everything after it goes to the thread. */
export function ResultView({ caseRow, consults, savedIds, feedback, help, autoSpeak }: ResultProps) {
  const router = useRouter();
  const { settings, user, toast, openKeepCase, setPersona, persona: activePersona, online } = useApp();
  const first = consults.find((c) => c.kind === "initial") ?? consults[0]!;
  const persona = first.persona;
  const p = PERSONAS[persona];
  const perf = usePerformance(first.id);
  const speakReq = useSpeakConsult();
  const [saved, setSaved] = useState(savedIds.includes(first.id));
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [voice, setVoice] = useState(false);
  const [moreSituation, setMoreSituation] = useState(false);
  const composerFocus = useRef(false);
  const [focusTick, setFocusTick] = useState(0);
  const played = useRef(false);

  // Re-tint the app to the persona who answered.
  useEffect(() => {
    if (activePersona !== persona && first.mode !== "care") setPersona(persona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  const promptKeep = () => {
    if (!user.isGuest) return;
    const k = `specter.kept.${caseRow.id}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      // ignore
    }
    setTimeout(() => openKeepCase(false), 600);
  };

  useEffect(() => {
    if (first.mode === "care" || played.current) return;
    played.current = true;
    if (autoSpeak && settings.speak) {
      void perf.play(speakReq(first)).then((r) => r === "done" && promptKeep());
    } else if (autoSpeak) {
      promptKeep();
    }
    return () => perf.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (first.mode === "care") {
    return (
      <div className="scr" style={themeVars(PERSONAS[persona].theme) as CSSProperties}>
        <div className="topbar">
          <Link href="/" className="ib" aria-label="Back">
            <IconBack />
          </Link>
          <span />
        </div>
        <main className="body">
          <CareView consult={first} help={help} autoSpeak={autoSpeak} />
        </main>
      </div>
    );
  }

  const others = personaList().filter((x) => x.id !== persona);
  const answered = new Set(consults.map((c) => c.persona));
  const goThread = (req: Parameters<typeof setPending>[0] | null, hash?: string) => {
    perf.stop();
    if (req) setPending(req);
    router.push(`/cases/${caseRow.id}${hash ? `#${hash}` : ""}`);
  };

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      await api("/api/saved", { method: "PUT", json: { consultId: first.id, saved: next } });
      toast(next ? "Saved to your lines" : "Removed from saved lines", { ok: next });
    } catch {
      setSaved(!next);
      toast("Couldn't save that. Try again.");
    }
  }

  async function share() {
    const t = `${copyLineText(first)} via Specter`;
    if (navigator.share) {
      try {
        await navigator.share({ text: t });
        return;
      } catch {
        return;
      }
    }
    toast((await copyText(t)) ? "Copied" : "Couldn't copy. Select the line instead.");
  }

  async function deleteCase() {
    setConfirmDelete(false);
    perf.stop();
    await api(`/api/cases/${caseRow.id}`, { method: "DELETE" }).catch(() => undefined);
    toast("Case deleted.");
    router.push("/");
    router.refresh();
  }

  const situation = caseRow.situation;
  return (
    <div className={`scr${perf.state === "speaking" || perf.state === "pausing" ? " speaking" : ""}${perf.state === "pausing" ? " pausing" : ""}`}>
      <div className="topbar" style={{ position: "relative" }}>
        <Link href="/" className="ib" aria-label="Back" onClick={() => perf.stop()}>
          <IconBack />
        </Link>
        <span className="ttl" data-testid="matter">
          {caseRow.title ?? first.reply.matter}
        </span>
        <button type="button" className="ib" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <IconMore />
        </button>
        {menu && (
          <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setMenu(false);
                toast((await copyText(copyLineText(first))) ? "Copied" : "Couldn't copy. Select the line instead.");
              }}
              data-testid="copy-line"
            >
              Copy line
            </button>
            <button type="button" role="menuitem" onClick={() => (setMenu(false), void share())}>
              Share
            </button>
            <button type="button" role="menuitem" className="danger" onClick={() => (setMenu(false), setConfirmDelete(true))}>
              Delete case
            </button>
          </div>
        )}
      </div>
      <OfflineBanner />
      <main className="body stack" style={{ gap: 16, paddingTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar persona={persona} size="lg" halo={1} />
          <div>
            <h1 className="t2">{p.name}</h1>
            <p className="small">{p.role}</p>
          </div>
        </div>
        <p className="you">
          <span className="tag">You</span>
          <span data-testid="situation-echo" style={moreSituation ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {situation}
          </span>
        </p>
        {!moreSituation && situation.length > 180 && (
          <button type="button" className="textbtn" style={{ marginTop: -12 }} onClick={() => setMoreSituation(true)}>
            More
          </button>
        )}
        <LineCard
          persona={persona}
          data={first.reply}
          perf={perf}
          onPlay={() => void perf.play(speakReq(first))}
          saved={saved}
          onToggleSave={toggleSave}
        />
        <AdviceCards persona={persona} reply={first.reply} onPick={(q) => setText(q)} />
        <MomentRow caseId={caseRow.id} momentAt={caseRow.moment_at} />
        <div className="row-actions" style={{ display: "grid", gridTemplateColumns: first.mode === "decline" ? "1fr 1fr" : "1fr 1fr 1fr" }}>
          <button type="button" className="soft" onClick={() => void perf.play(speakReq(first))} style={{ justifyContent: "center" }}>
            <IconReplay />
            Replay
          </button>
          {first.mode !== "decline" && (
            <button
              type="button"
              className="soft"
              style={{ justifyContent: "center" }}
              disabled={!online}
              onClick={() => goThread({ request: { action: "another", caseId: caseRow.id, persona, intensity: settings.intensity }, speak: true })}
              data-testid="another-take"
            >
              <IconRedo />
              New take
            </button>
          )}
          <button
            type="button"
            className="soft"
            style={{ justifyContent: "center" }}
            onClick={() => {
              composerFocus.current = true;
              setFocusTick((t) => t + 1);
            }}
          >
            <IconPush />
            Push back
          </button>
        </div>
        <p className="label" style={{ marginTop: 8 }}>
          Ask another persona
        </p>
        <div className="row-actions">
          {others.map((o) => {
            const theirs = consults.find((c) => c.persona === o.id);
            return (
              <button
                key={o.id}
                type="button"
                className="chip persona"
                style={themeVars(o.theme) as CSSProperties}
                disabled={!theirs && !online}
                data-testid={`ask-${o.id}`}
                onClick={() =>
                  theirs
                    ? goThread(null, `c-${theirs.id}`)
                    : goThread({ request: { action: "switch", caseId: caseRow.id, persona: o.id as PersonaId, intensity: settings.intensity }, speak: true })
                }
              >
                <Avatar persona={o.id} size="sm" />
                {answered.has(o.id) ? `See ${o.short}'s take` : `Ask ${o.short}`}
              </button>
            );
          })}
        </div>
        <FeedbackRow consultId={first.id} initial={feedback[first.id] ?? null} />
        <p className="fine">{BRAND.disclaimer}</p>
      </main>
      <Composer
        key={focusTick}
        autoFocus={focusTick > 0}
        value={text}
        onChange={setText}
        placeholder={personaPlaceholder(persona, true)}
        onMic={() => setVoice(true)}
        onSubmit={() => goThread({ request: { action: "followup", caseId: caseRow.id, persona, intensity: settings.intensity, text: text.trim() }, speak: true })}
      />
      {voice && (
        <VoiceMode
          persona={persona}
          caseId={caseRow.id}
          onClose={() => setVoice(false)}
          onFinished={() => {
            setVoice(false);
            router.push(`/cases/${caseRow.id}`);
          }}
        />
      )}
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this case?">
        <p className="small">This deletes the case, every reply in it and any lines you saved from it. It can&apos;t be undone.</p>
        <button type="button" className="btn destructive fill" onClick={deleteCase} data-testid="confirm-delete-case">
          Delete case
        </button>
        <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
          Keep it
        </button>
      </Sheet>
      {perf.state === "idle" && null}
      {false && <ErrorBanner>{""}</ErrorBanner>}
    </div>
  );
}
