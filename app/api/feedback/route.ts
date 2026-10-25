import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  consultId: z.string().min(1),
  rating: z.enum(["up", "down"]),
  reason: z.enum(["too_long", "off_target", "not_their_voice", "unsafe", "other"]).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

/** POST /api/feedback: thumbs up or down per consult, with an optional reason. */
export const POST = withSession(async (session, req) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("bad_request", "Invalid feedback.", 400);
  const f = parsed.data;
  if (!(await session.store.getConsult(f.consultId))) return jsonError("not_found", "That reply doesn't exist.", 404);
  await session.store.setFeedback({ consult_id: f.consultId, rating: f.rating, reason: f.reason ?? null, note: f.note || null });
  return NextResponse.json({ ok: true });
});
