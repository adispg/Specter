import { NextResponse } from "next/server";
import { withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/cases/all?limit=N: list recent cases (default 50). */
export const GET = withSession(async (session, req) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const cases = await session.store.listCases(isNaN(limit) ? 50 : limit);
  return NextResponse.json({ cases });
});

/** DELETE /api/cases/all: delete every case (Settings, Privacy). */
export const DELETE = withSession(async (session) => {
  const cases = await session.store.listCases(10_000);
  for (const c of cases) await session.store.deleteCase(c.id);
  return NextResponse.json({ ok: true, deleted: cases.length });
});
