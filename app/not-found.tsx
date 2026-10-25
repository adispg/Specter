import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Not found" };

/**
 * Branded 404. Same single centred column as /sign-in and /offline so an
 * unknown route still looks like the product: wordmark, one line in the
 * product's voice, one way back. The earlier version used inline styles and a
 * hardcoded blue that belonged to no token in the design system.
 */
export default function NotFound() {
  return (
    <main className="authscr">
      <div className="authbox">
        <Wordmark />
        <div className="authhead">
          <h1 className="t-hero">Wrong room.</h1>
          <p className="small">
            Nothing lives at this address. The situation you were working on is still on the home
            screen.
          </p>
        </div>
        <Link className="btn primary" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
