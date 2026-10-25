import { NextResponse } from "next/server";
import { withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/saved/:id: remove one saved line. */
export const DELETE = withSession(async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await session.store.deleteSavedLine(id);
  return NextResponse.json({ ok: true });
});
