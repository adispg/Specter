import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withSession(async (session, _req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const c = await session.store.getCase(id);
  if (!c) return jsonError("not_found", "This case was deleted.", 404);
  return NextResponse.json({ case: c, consults: await session.store.listConsults(id) });
});

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  moment_at: z.string().datetime({ offset: true }).nullable().optional(),
  debrief_status: z.enum(["used", "partly", "not_used"]).optional(),
  debrief_note: z.string().trim().max(1000).nullable().optional(),
});

/** PATCH /api/cases/:id: rename, set "when is it happening", record the debrief. */
export const PATCH = withSession(async (session, req, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!(await session.store.getCase(id))) return jsonError("not_found", "This case was deleted.", 404);
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("bad_request", parsed.error.issues[0]?.message ?? "Invalid update.", 400);
  await session.store.updateCase(id, parsed.data);
  return NextResponse.json({ case: await session.store.getCase(id) });
});

/** DELETE /api/cases/:id: hard delete of the case, its consults, saved lines and cached audio. */
export const DELETE = withSession(async (session, _req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await session.store.deleteCase(id);
  return NextResponse.json({ ok: true });
});
