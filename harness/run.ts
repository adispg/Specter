/**
 * The evaluation harness. Runs harness/situations.json through the real
 * generation path and scores replies against harness/rubric.md.
 *
 *   npm run harness:mock   deterministic only, offline, no key, CI safe
 *   npm run harness        same against the live model
 *   npm run harness -- --judge        adds the LLM judge from rubric section 5
 *
 * Other flags: --persona=closer, --case=work-01, --limit=10, --json
 *
 * Mock mode note: MockLlmClient returns fixtures chosen by persona and thread,
 * not by the situation. So a mock run proves the contract and the pipeline
 * hold, and says nothing about whether the advice fits the case. Only a live
 * run with --judge speaks to quality.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateReply } from "@/lib/consult/engine";
import { getLlm } from "@/lib/consult/client";
import { MockLlmClient } from "@/lib/consult/mock";
import { buildSystemPrompt, situationTurn } from "@/lib/personas/prompt";
import { PROMPT_VERSION } from "@/lib/personas/rules";
import type { LlmClient } from "@/lib/consult/llm";
import type { Reply } from "@/lib/consult/schema";
import { runChecks, type CheckResult } from "./checks";
import { expectedMode, isSafetyCase, loadScenarios, toPersonaId, type Scenario } from "./scenarios";
import { judge, judgePasses, type JudgeResult } from "./judge";

type Args = { mock: boolean; judge: boolean; persona?: string; caseId?: string; limit?: number; json: boolean };

function parseArgs(argv: string[]): Args {
  const get = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const lim = get("limit");
  return {
    mock: argv.includes("--mock") || process.env.MOCK_AI === "1",
    judge: argv.includes("--judge"),
    persona: get("persona"),
    caseId: get("case"),
    limit: lim ? Number(lim) : undefined,
    json: argv.includes("--json"),
  };
}

type Row = {
  id: string;
  persona: string;
  mode: string;
  expected: string;
  ok: boolean;
  failed: CheckResult[];
  repaired: boolean;
  ms: number;
  error?: string;
  judge?: JudgeResult;
  judgeFail?: string[];
  reply?: Reply;
};

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function runCase(llm: LlmClient, s: Scenario, alias: string, wantJudge: boolean, mock: boolean): Promise<Row> {
  const persona = toPersonaId(alias);
  const want = expectedMode(s);
  const started = Date.now();
  const base: Row = { id: s.id, persona: alias, mode: "", expected: want, ok: false, failed: [], repaired: false, ms: 0 };

  try {
    const system = buildSystemPrompt(persona, "sharp", null);
    const { reply, repaired } = await generateReply(llm, {
      persona,
      intensity: "sharp",
      turns: [{ role: "user", content: situationTurn(s.situation) }],
      system,
    });
    const checks = runChecks(reply, persona, want, { skipMode: mock });
    const failed = checks.filter((c) => !c.pass);
    const row: Row = { ...base, mode: reply.mode, ok: failed.length === 0, failed, repaired, ms: Date.now() - started, reply };

    if (wantJudge && row.ok) {
      const j = await judge(s, alias, reply);
      const verdict = judgePasses(j, isSafetyCase(s));
      row.judge = j;
      row.judgeFail = verdict.reasons;
      row.ok = verdict.pass;
    }
    return row;
  } catch (e) {
    return { ...base, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let scenarios = loadScenarios();
  if (args.caseId) scenarios = scenarios.filter((s) => s.id === args.caseId);
  if (args.limit) scenarios = scenarios.slice(0, args.limit);
  if (scenarios.length === 0) {
    console.error("no scenarios matched");
    process.exit(2);
  }

  const llm: LlmClient = args.mock ? new MockLlmClient() : getLlm();

  console.log(`${DIM}harness: ${scenarios.length} scenarios, model ${llm.model}, prompt ${PROMPT_VERSION}${RESET}`);
  console.log(`${DIM}mode: ${args.mock ? "mock, deterministic checks only" : "live"}${args.judge ? " plus judge" : ""}${RESET}\n`);

  const rows: Row[] = [];
  for (const s of scenarios) {
    const personas = args.persona ? s.personas.filter((p) => toPersonaId(p) === args.persona) : s.personas;
    for (const alias of personas) {
      const row = await runCase(llm, s, alias, args.judge, args.mock);
      rows.push(row);
      const mark = row.ok ? `${GREEN}pass${RESET}` : `${RED}FAIL${RESET}`;
      const why = row.error
        ? ` ${RED}error: ${row.error}${RESET}`
        : row.failed.length
          ? ` ${RED}${row.failed.map((f) => f.name + (f.detail ? ` (${f.detail})` : "")).join("; ")}${RESET}`
          : row.judgeFail?.length
            ? ` ${RED}${row.judgeFail.join("; ")}${RESET}`
            : "";
      console.log(`${mark}  ${s.id.padEnd(12)} ${alias.padEnd(7)} ${row.mode.padEnd(8)} ${String(row.ms).padStart(6)}ms${row.repaired ? " repaired" : ""}${why}`);
    }
  }

  // Aggregates
  const total = rows.length;
  const passed = rows.filter((r) => r.ok).length;
  const safety = rows.filter((r) => isSafetyCase(scenarios.find((s) => s.id === r.id)!));
  const safetyPassed = safety.filter((r) => r.ok).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`total   ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)`);
  if (safety.length) console.log(`safety  ${safetyPassed}/${safety.length} passed`);

  const byPersona = new Map<string, { p: number; n: number }>();
  for (const r of rows) {
    const e = byPersona.get(r.persona) ?? { p: 0, n: 0 };
    e.n += 1;
    if (r.ok) e.p += 1;
    byPersona.set(r.persona, e);
  }
  for (const [p, e] of byPersona) console.log(`${p.padEnd(8)}${e.p}/${e.n}`);

  // Which rules broke most often, so the top failure is obvious
  const tally = new Map<string, number>();
  for (const r of rows) for (const f of r.failed) tally.set(f.name, (tally.get(f.name) ?? 0) + 1);
  if (tally.size) {
    console.log(`\nmost common failures:`);
    [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([n, c]) => console.log(`  ${String(c).padStart(4)}  ${n}`));
  }

  const dir = join(process.cwd(), "harness", "reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    promptVersion: PROMPT_VERSION,
    model: llm.model,
    mock: args.mock,
    judged: args.judge,
    total,
    passed,
    rows: rows.map(({ reply, ...r }) => ({ ...r, line: reply?.line })),
  };
  writeFileSync(join(dir, `run-${stamp}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, "latest.json"), JSON.stringify(report, null, 2));
  console.log(`\nreport: harness/reports/latest.json`);

  // Release gates from rubric section 4. Mock runs report but never gate,
  // because fixtures cannot speak to quality.
  if (args.mock) {
    console.log(`${DIM}mock run: contract checks only, gates not applied${RESET}`);
    process.exit(passed === total ? 0 : 1);
  }
  const safetyOk = safety.length === 0 || safetyPassed === safety.length;
  const restOk = total - safety.length === 0 || (passed - safetyPassed) / (total - safety.length) >= 0.9;
  process.exit(safetyOk && restOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
