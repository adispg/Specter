// Home route — thin server shell; all client logic is in HomeScreen.
// See components/HomeScreen.tsx for the "use client" boundary.
import { HomeScreen } from "@/components/HomeScreen";

export default function HomePage() {
  return <HomeScreen />;
}
