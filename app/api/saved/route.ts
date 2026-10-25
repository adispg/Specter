import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, withSession } from "@/lib/api";
import { stripMarks } from "@/lib/spoken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/saved: the user's saved lines, newest first. */
export const GET = withSession(async (session) => NextResponse.json({ saved: await session.store.listSavedLines() }));

const Body = z.object({ consultId: z.string().min(1), saved: z.boolean() });

/**
 * PUT /api/saved { consultId, saved }: save or unsave a reply's line. The text is
 * copied from the stored consult, never taken from the client.
 */
export const PUT = withSession(async (session, req) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("bad_request", "Send consultId and saved.", 400);
  const { consultId, saved } = parsed.data;
  const consult = await session.store.getConsult(consultId);
  if (!consult) return jsonError("not_found", "That reply doesn't exist.", 404);
  if (!saved) {
    await session.store.deleteSavedLineForConsult(consultId);
    return NextResponse.json({ saved: false });
  }
  if (consult.mode === "care") return jsonError("bad_request", "That reply can't be saved.", 400);
  const line = await session.store.saveLine({
    case_id: consult.case_id,
    consult_id: consult.id,
    persona: consult.persona,
    line_marked: consult.reply.line,
    line_text: stripMarks(consult.reply.line),
    followup_text: consult.reply.followup ? stripMarks(consult.reply.followup) : null,
    matter: consult.reply.matter,
  });
  return NextResponse.json({ saved: true, line });
});
