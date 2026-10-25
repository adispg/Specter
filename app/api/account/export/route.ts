import { withSession } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account/export: everything we hold for this user, as a JSON download. */
export const GET = withSession(async (session) => {
  const bundle = await session.store.exportAll();
  const body = JSON.stringify({ ...bundle, account: { id: session.user.id, email: session.user.email } }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="specter-data-${date}.json"`,
      "cache-control": "no-store",
    },
  });
});
