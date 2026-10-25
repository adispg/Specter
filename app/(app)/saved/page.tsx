import Link from "next/link";
import { getSession } from "@/lib/auth";
import { TabBar, relTime } from "@/components/ui";
import { Avatar } from "@/components/Persona";
import type { SavedLine } from "@/lib/data/types";

export const dynamic = "force-dynamic";

function LineCard({ line }: { line: SavedLine }) {
  return (
    <div
      data-testid="saved-line-card"
      style={{
        padding: "16px var(--gutter-r) 16px var(--gutter-l)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Avatar persona={line.persona} size="xs" />
        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{relTime(line.created_at)}</span>
        {line.matter && (
          <span
            style={{
              fontSize: 11,
              color: "var(--fg-3)",
              padding: "2px 6px",
              background: "var(--surface)",
              borderRadius: 4,
              border: "1px solid var(--border)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {line.matter}
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "var(--fg-1)",
          margin: "0 0 6px",
        }}
      >
        {line.line_text}
      </p>

      {line.followup_text && (
        <p
          style={{
            fontSize: 14,
            color: "var(--fg-2)",
            lineHeight: 1.5,
            margin: "0 0 10px",
          }}
        >
          {line.followup_text}
        </p>
      )}

      {line.case_id && (
        <Link
          href={`/cases/${line.case_id}`}
          style={{
            fontSize: 12,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          View case
        </Link>
      )}
    </div>
  );
}

export default async function SavedPage() {
  const session = await getSession();
  const lines: SavedLine[] = session ? await session.store.listSavedLines() : [];

  return (
    <div className="scr">
      <header style={{ padding: "16px var(--gutter-r) 0 var(--gutter-l)" }}>
        <h1 className="t1" style={{ fontSize: 20 }}>Saved</h1>
      </header>

      <main className="screen-main" style={{ paddingTop: 8 }}>
        {lines.length === 0 ? (
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
            <p style={{ fontSize: 16 }}>Nothing saved yet.</p>
            <p style={{ fontSize: 14 }}>Tap the bookmark on any line.</p>
          </div>
        ) : (
          <div>
            {lines.map((line) => (
              <LineCard key={line.id} line={line} />
            ))}
          </div>
        )}
      </main>

      <TabBar />
    </div>
  );
}
