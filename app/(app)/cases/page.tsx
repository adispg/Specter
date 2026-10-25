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
          {c.title ?? c.situation.slice(0, 80)}
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

export default async function CasesPage() {
  const session = await getSession();
  const cases: CaseSummary[] = session ? await session.store.listCases(50) : [];

  return (
    <div className="screen">
      <header style={{ padding: "16px var(--gutter-r) 0 var(--gutter-l)" }}>
        <h1 className="t1" style={{ fontSize: 20 }}>Cases</h1>
      </header>

      <main className="screen-main" style={{ paddingTop: 8 }}>
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
