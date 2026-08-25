// Wires up the OS-level "app was opened via lykodex://auth-callback"
// event to actually applying the OAuth session — see auth.js's
// signInWithOAuth for why packaged apps need this at all (there's no
// window.location redirect back into a webview from an external
// browser). Capacitor (Android/iOS) and Tauri (desktop) each expose
// this as a different event, so both are wired here; plain web needs
// neither (Supabase's own detectSessionInUrl handles that case).
//
// Call once at app startup (see App.jsx) — safe to call on web too,
// both branches below no-op there since isPackagedApp() is false.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isPackagedApp, isTauri } from "./platform";
import { handleOAuthRedirectUrl } from "./auth";

export function initOAuthRedirectListener() {
  if (!isPackagedApp()) return;

  if (isTauri()) {
    onOpenUrl((urls) => {
      for (const url of urls) {
        handleOAuthRedirectUrl(url).catch((err) => console.error("OAuth redirect failed:", err));
      }
    });
    return;
  }

  if (Capacitor.isNativePlatform()) {
    App.addListener("appUrlOpen", ({ url }) => {
      handleOAuthRedirectUrl(url).catch((err) => console.error("OAuth redirect failed:", err));
    });
  }
}
