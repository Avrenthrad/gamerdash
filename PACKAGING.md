# Desktop & Mobile Packaging — Groundwork Status

This covers wrapping the same Lykodex web app as a downloadable
desktop app (Tauri) and iOS/Android apps (Capacitor) — no UI rewrite,
same React/Vite codebase, just wrapped.

## What's already done

- **Tauri config** (`src-tauri/`) — full config, minimal Rust
  scaffolding, and a **real generated icon set** from the actual
  Lykodex logo (desktop `.ico`/`.icns` plus the full iOS/Android
  icon sizes as a bonus from the same command).
- **Capacitor config** (`capacitor.config.json`) — plus the actual
  native Android and iOS project folders (`android/`, `ios/`) are
  already scaffolded and ready.
- npm scripts added: `tauri:dev`, `tauri:build`, `cap:sync`,
  `cap:android`, `cap:ios`.

## ⚠️ The one thing that has to happen before any of this really works

Every API call in this app currently uses a **relative** path —
`fetch("/api/steam?...")` etc. That works fine on a normal website,
because "relative to this page" and "this page's own server" are the
same thing.

A packaged desktop/mobile app doesn't have that — it loads its files
locally, not from a live website, so there's no server for a relative
`/api/...` path to resolve against. **Once this project is deployed to
a real URL**, every one of those fetch calls needs to become an
absolute URL pointing at that deployment (e.g.
`https://lykodex.vercel.app/api/steam?...`), typically via one
shared constant/env value so it's a single-line change, not a
per-file rewrite.

This is the actual reason desktop/mobile packaging couldn't be
*finished* today — it's blocked on deployment being live, same as
Destiny 2 OAuth was. The scaffolding above is ready and waiting.

## What you'll need to do on your own machine

**Desktop (Tauri):**
1. Install [Rust](https://www.rust-lang.org/tools/install) (this sandbox doesn't have it, so I couldn't test-build it myself)
2. `npm run tauri:dev` — opens the app in a native window using your local dev server
3. `npm run tauri:build` — produces a real installer (once the API URL fix above is done)

**Mobile (Capacitor):**
1. Android: install [Android Studio](https://developer.android.com/studio), then `npm run cap:android`
2. iOS: needs a Mac with Xcode installed, then `npm run cap:ios`
3. After any change to the web app: `npm run build` then `npm run cap:sync` to push the update into both native projects

**Icons for Capacitor specifically:** the Tauri icon generation also
produced usable Android/iOS icon assets as a side effect, but they
aren't wired into the Capacitor projects yet — the clean way to do
that is the `@capacitor/assets` tool pointed at the same square logo.
Flag me when you're ready for that pass and I'll wire it in properly
rather than manually copying files into place blind.
