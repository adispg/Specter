"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TabBar, relTime } from "@/components/ui";
import { Avatar } from "@/components/Persona";
import { useApp } from "@/components/AppProvider";
import type { SavedLine } from "@/lib/data/types";

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function LineCard({
  line,
  onDelete,
  deleting,
}: {
  line: SavedLine;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      data-testid="saved-line-card"
      style={{
        padding: "16px var(--gutter-r, 16px) 16px var(--gutter-l, 16px)",
        borderBottom: "1px solid var(--border)",
        opacity: deleting ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* Delete button */}
        <button
          type="button"
          aria-label="Remove saved line"
          disabled={deleting}
          onClick={() => onDelete(line.id)}
          style={{
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--fg-3)",
            cursor: "pointer",
            opacity: deleting ? 0.4 : 1,
            transition: "color 0.15s, background 0.15s",
            marginTop: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--danger, #e55)";
            (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--danger, #e55) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-3)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

function PersonaFilter({
  personas,
  active,
  onChange,
}: {
  personas: string[];
  active: string | null;
  onChange: (p: string | null) => void;
}) {
  if (personas.length < 2) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "10px var(--gutter-l, 16px)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 12px",
          borderRadius: 20,
          border: "1px solid",
          borderColor: active === null ? "var(--accent)" : "var(--border)",
          background: active === null ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
          color: active === null ? "var(--accent)" : "var(--fg-3)",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        All
      </button>
      {personas.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p === active ? null : p)}
          style={{
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 20,
            border: "1px solid",
            borderColor: active === p ? "var(--accent)" : "var(--border)",
            background: active === p ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
            color: active === p ? "var(--accent)" : "var(--fg-3)",
            cursor: "pointer",
            textTransform: "capitalize",
            transition: "all 0.15s",
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export default function SavedPage() {
  const { toast } = useApp();
  const [lines, setLines] = useState<SavedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [filterPersona, setFilterPersona] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/saved")
      .then((r) => r.json())
      .then((data: { saved?: SavedLine[] } | SavedLine[]) => {
        const arr = Array.isArray(data) ? data : (data as { saved?: SavedLine[] }).saved ?? [];
        setLines(arr);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/saved/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`${res.status}`);
        setLines((prev) => prev.filter((l) => l.id !== id));
        toast("Line removed", { ok: true });
      } catch {
        toast("Couldn't remove that. Try again.");
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [toast]
  );

  const personas = Array.from(new Set(lines.map((l) => l.persona)));
  const visible = filterPersona ? lines.filter((l) => l.persona === filterPersona) : lines;

  return (
    <div className="screen">
      <header style={{ padding: "16px var(--gutter-r, 16px) 0 var(--gutter-l, 16px)" }}>
        <h1 className="t1" style={{ fontSize: 20 }}>Saved</h1>
      </header>

      <main className="screen-main" style={{ paddingTop: 0 }}>
        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--fg-3)" }}>
            Loading...
          </div>
        ) : lines.length === 0 ? (
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
          <>
            <PersonaFilter
              personas={personas}
              active={filterPersona}
              onChange={setFilterPersona}
            />
            {visible.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-3)" }}>
                <p style={{ fontSize: 14 }}>No lines from this advisor.</p>
              </div>
            ) : (
              <div>
                {visible.map((line) => (
                  <LineCard
                    key={line.id}
                    line={line}
                    onDelete={handleDelete}
                    deleting={deletingIds.has(line.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}
