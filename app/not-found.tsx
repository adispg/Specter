import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "0 24px",
        textAlign: "center",
        minHeight: "100dvh",
      }}
    >
      <p style={{ fontSize: 48, lineHeight: 1, margin: 0 }}>404</p>
      <p style={{ margin: 0, color: "var(--fg-2, #8893a4)", fontSize: 15 }}>
        That page does not exist.
      </p>
      <Link
        href="/"
        style={{
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 8,
          background: "var(--accent, #4f8ef7)",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
