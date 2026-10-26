import Link from "next/link";
import { getSession } from "@/lib/auth";
import { TabBar, relTime } from "@/components/ui";
import { Avatar } from "@/components/Persona";
import type { CaseSummary } from "@/lib/data/types";

export const dynamic = "force-dynamic";

function CaseCard({ c }: { c: CaseSummary }) {
  const latestPersona = c.latest_persona ?? c.persona;
  return (
    <Link
      href={`/cases/${c.id}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        textDecoration: "none",
        color: "inherit",
      }}
      data-testid="case-row"
    >
      <Avatar persona={latestPersona} size="sm" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "var(--fg-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {c.title || c.situation?.slice(0, 80) || "Untitled case"}
        </div>
        {c.latest_line && (
          <div
            style={{
              fontSize: 13,
              color: "var(--fg-2)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.latest_line}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>
          {relTime(c.last_activity_at)}
        </div>
      </div>
    </Link>
  );
}

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ debug?: string }> }) {
  const session = await getSession();

  // A list screen should not 500. It is one tap from the tab bar, so a query
  // problem here used to take out a whole destination with no way back. Log the
  // real reason, show the empty state, and surface the message only with
  // ?debug=1 so it never reaches an ordinary visitor.
  let cases: CaseSummary[] = [];
  let loadError: string | null = null;
  if (session) {
    try {
      cases = await session.store.listCases(50);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      console.error(`[cases] list failed: ${loadError}`);
    }
  }
  const debug = (await searchParams).debug === "1";

  return (
    <div className="screen">
      <header style={{ padding: "16px var(--gutter-r) 0 var(--gutter-l)" }}>
        <h1 className="t1" style={{ fontSize: 20 }}>Cases</h1>
      </header>

      <main className="screen-main" style={{ paddingTop: 8 }}>
        {debug && loadError && (
          <pre
            style={{
              margin: "0 16px 12px",
              padding: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              color: "var(--danger)",
              background: "var(--danger-bg)",
              border: "1px solid var(--hair-2)",
              borderRadius: 8,
            }}
          >
            {loadError}
          </pre>
        )}
        {cases.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 12,
              color: "var(--fg-3)",
              textAlign: "center",
              padding: "60px 24px",
            }}
          >
            <p style={{ fontSize: 16 }}>No cases yet.</p>
            <p style={{ fontSize: 14 }}>Ask your first question.</p>
            <Link href="/" className="cta" style={{ marginTop: 8, display: "inline-block", textDecoration: "none" }}>
              Start a consult
            </Link>
          </div>
        ) : (
          <div>
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </main>

      <TabBar />
    </div>
  );
}
