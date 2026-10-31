import Link from "next/link";
import { BRAND } from "@/lib/personas/config";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 80px" }}>
      <Link
        href="/settings"
        style={{ fontSize: 14, color: "var(--accent)", textDecoration: "none", display: "inline-block", marginBottom: 32 }}
      >
        &larr; Back
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "var(--fg-1)" }}>
        Privacy policy
      </h1>
      <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 40 }}>
        Last updated: {new Date().getFullYear()}
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--fg-1)" }}>
          What we collect
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)" }}>
          {BRAND.appName} stores the situations and follow-up messages you submit, the responses
          generated for you, and basic account information (email address). We also collect
          anonymous usage counts to understand how the app is used.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--fg-1)" }}>
          How we use it
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)" }}>
          Your data is used solely to provide the service: storing your cases, generating
          responses, and improving reliability. We do not sell your data or use it for
          advertising.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--fg-1)" }}>
          Third-party services
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)" }}>
          We use Supabase for data storage and authentication, and Google Gemini to generate
          responses. Your input is sent to these services to operate the product. Responses
          generated are not used to train external models.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--fg-1)" }}>
          Deleting your data
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)" }}>
          You can delete all your cases or your entire account at any time from Settings. Deletion
          is permanent and immediate.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--fg-1)" }}>
          Contact
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--fg-2)" }}>
          Questions about privacy? Reach out through the app or open a case describing your
          concern and we will get back to you.
        </p>
      </section>

      <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 48 }}>
        {BRAND.appName} &copy; {new Date().getFullYear()}
      </p>
    </main>
  );
}
