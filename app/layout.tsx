import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import { BRAND } from "@/lib/personas/config";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.appName, template: `%s · ${BRAND.appName}` },
  description: BRAND.promise,
  applicationName: BRAND.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.appName, statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090c12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
