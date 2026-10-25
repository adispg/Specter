// Home route - client logic lives in HomeScreen to satisfy Next.js 15
// server-component requirement for route pages in route groups.
import { HomeScreen } from "@/components/HomeScreen";

export default function HomePage() {
  return <HomeScreen />;
}
