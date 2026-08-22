// Detects whether this is running as a packaged app (Tauri desktop or
// Capacitor mobile) rather than the plain website. The website
// intentionally allows anonymous browsing — most pages already show
// real content with inline "Sign in to see X here" prompts rather than
// a hard login wall. A dedicated installed app is opened specifically
// to use an account, so it gets different boot behavior (see
// AppContext.jsx's hash-routing init) — same kind of packaged-vs-web
// split src/lib/apiBase.js already makes for API calls.

import { Capacitor } from "@capacitor/core";

export function isPackagedApp() {
  return Capacitor.isNativePlatform() || isTauri();
}

// The desktop build specifically — the auto-updater plugin only exists
// there (mobile app stores handle their own update delivery), so
// anything calling it needs to check this, not the broader
// isPackagedApp().
export function isTauri() {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}
