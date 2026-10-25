import { NextResponse } from "next/server";
import { withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/cases/all: delete every case (Settings, Privacy). */
export const DELETE = withSession(async (session) => {
  const cases = await session.store.listCases(10_000);
  for (const c of cases) await session.store.deleteCase(c.id);
  return NextResponse.json({ ok: true, deleted: cases.length });
});
