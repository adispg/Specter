import { HomeScreen } from "@/components/HomeScreen";

// Must stay dynamic. This page renders under the (app) layout, which reads the
// session and redirects signed-out visitors to /welcome. Without this, Next
// prerenders "/" at build time, where there is never a session, and bakes a
// permanent 307 to /welcome into the static output: every signed-in visitor is
// bounced back to the welcome screen no matter what cookies they hold.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <HomeScreen />;
}
