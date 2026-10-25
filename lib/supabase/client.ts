"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (sign-in only; data goes through server routes). */
export function createSupabaseBrowserClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}
