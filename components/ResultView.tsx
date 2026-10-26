"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRAND, PERSONAS, personaList, themeVars, type PersonaId, type RegionHelp } from "@/lib/personas/config";
import type { CaseRow, ConsultRow } from "@/lib/data/types";
import type { ConsultRequest } from "@/lib/consult/schema";
import { stripMarks } from "@/lib/spoken";
import { api } from "@/lib/client/api";
import { usePerformance } from "@/lib/client/usePerformance";
import { buildShareText, shareLine } from "@/lib/client/shareCard";
import { useConsult } from "@/lib/client/useConsult";
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
  const [sharing, setSharing] = useState(false);
  const consult = useConsult();
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

  /**
   * Run a follow-up, another take or another persona's view on this case.
   *
   * This used to stash the request with setPending and push to the route it was
   * already on, which Next treats as a no-op, and nothing ever read the stash
   * back. So Ask Mike, Ask Donna, New take and the follow-up composer all did
   * nothing at all. Run it here and refresh so the server sends the new thread.
   */
  const goThread = async (req: ConsultRequest | null, hash?: string) => {
    perf.stop();
    if (!req) {
      if (hash) router.push(`/cases/${caseRow.id}#${hash}`);
      return;
    }
    const res = await consult.run(req);
    if (!res) return;
    setText("");
    router.refresh();
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

  /**
   * Share the first reply as a card: the line and the principle only.
   *
   * The previous version sent a helper that appended the persona's
   * display name and the follow-up. The follow-up is direction aimed at this
   * user's situation and reads as nonsense out of context, and the name turns
   * a private reading into distribution under a character's identity. Neither
   * belongs in something that leaves the app.
   */
  async function shareFirst() {
    if (sharing || first.mode === "care") return;
    setSharing(true);
    try {
      const outcome = await shareLine({ persona, line: first.reply.line, principle: first.reply.principle });
      if (outcome === "copied") toast("Copied", { ok: true });
      else if (outcome === "failed") toast("Couldn't share that. Select the line instead.");
      // "shared" needs no toast, the share sheet is its own confirmation, and
      // "cancelled" means the user backed out on purpose.
    } finally {
      setSharing(false);
    }
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
                toast((await copyText(buildShareText({ persona, line: first.reply.line, principle: first.reply.principle }))) ? "Copied" : "Couldn't copy. Select the line instead.");
              }}
              data-testid="copy-line"
            >
              Copy line
            </button>
            <button type="button" role="menuitem" onClick={() => (setMenu(false), void shareFirst())}>
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
        {consult.error && (
          <ErrorBanner onRetry={() => void consult.retry()}>{consult.error}</ErrorBanner>
        )}
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
        {/* Care mode never reaches this card: it returns CareView above and
            offers no share control. TypeScript narrows first.mode to prove it,
            so a guard here would be dead code; shareFirst still checks at
            runtime in case that early return ever moves. */}
        <LineCard
          persona={persona}
          data={first.reply}
          perf={perf}
          onPlay={() => void perf.play(speakReq(first))}
          saved={saved}
          onToggleSave={toggleSave}
          sharing={sharing}
          onShare={shareFirst}
        />
        <AdviceCards persona={persona} reply={first.reply} onPick={(q) => setText(q)} />

        {/* Everything after the first reply. Until now the screen rendered only
            the initial consult, so New take, Ask Mike, Ask Donna and follow-ups
            each cost a model call, wrote a row, and showed the user nothing. */}
        {consults
          .filter((c) => c.id !== first.id)
          .map((c) => {
            const cp = PERSONAS[c.persona];
            return (
              <section key={c.id} id={`c-${c.id}`} className="tentry" data-testid="thread-entry">
                {c.kind === "followup" && c.user_input && (
                  <p className="you">
                    <span className="tag">You</span>
                    <span>{c.user_input}</span>
                  </p>
                )}
                <div className="thead">
                  <Avatar persona={c.persona} size="sm" />
                  <span className="nm">{cp.short}</span>
                  <span className="kd">
                    {c.kind === "switch" ? "their take" : c.kind === "another" ? "another take" : "follow-up"}
                  </span>
                  <button
                    type="button"
                    className="textbtn"
                    onClick={() => void perf.play(speakReq(c))}
                    aria-label={`Play ${cp.short}'s reply`}
                  >
                    Play
                  </button>
                </div>
                <p className="tline">{stripMarks(c.reply.line)}</p>
                {c.reply.followup && <p className="tfollow">{stripMarks(c.reply.followup)}</p>}
                <AdviceCards persona={c.persona} reply={c.reply} onPick={(q) => setText(q)} />
              </section>
            );
          })}

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
              disabled={!online || consult.busy}
              onClick={() => void goThread({ action: "another", caseId: caseRow.id, persona, intensity: settings.intensity })}
              data-testid="another-take"
            >
              <IconRedo />
              {consult.busy ? "Working" : "New take"}
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
                disabled={(!theirs && !online) || consult.busy}
                data-testid={`ask-${o.id}`}
                onClick={() =>
                  theirs
                    ? void goThread(null, `c-${theirs.id}`)
                    : void goThread({ action: "switch", caseId: caseRow.id, persona: o.id as PersonaId, intensity: settings.intensity })
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
        busy={consult.busy}
        onStop={consult.stop}
        onSubmit={() => void goThread({ action: "followup", caseId: caseRow.id, persona, intensity: settings.intensity, text: text.trim() })}
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
