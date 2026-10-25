import { redirect } from "next/navigation";

/**
 * Root entry point. The middleware handles auth-aware routing for signed-in
 * users, but if it falls through (Supabase not yet configured, or a cold
 * request before cookies are set), send everyone to the welcome screen so
 * the app never shows a bare 404.
 */
export default function RootPage() {
  redirect("/welcome");
}
