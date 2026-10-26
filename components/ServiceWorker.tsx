"use client";
import { useEffect } from "react";

/** Registers the app-shell service worker in production builds (not under automation). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || navigator.webdriver) return;
    // The build id rides on the URL so the worker can name its cache after it.
    // Changing the URL is also what makes the browser fetch a new worker on a
    // deploy rather than reusing the installed one.
    const v = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev");
    const register = () => navigator.serviceWorker.register(`/sw.js?v=${v}`, { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
