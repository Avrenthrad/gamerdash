// Shared by every /api/* proxy. Leading underscore keeps Vercel from
// treating this as its own route (it's not a handler — no `req`/`res`
// pair matching a request), so it doesn't count against the Hobby
// plan's 12-serverless-function limit alongside pricing.js's merge.
//
// Packaged desktop (Tauri) and mobile (Capacitor) builds serve the app
// from their own fixed local origin (e.g. https://tauri.localhost,
// https://localhost) rather than https://lykodex.vercel.app itself —
// see apiBase.js. Every fetch from those builds to this API is
// therefore cross-origin, and without this header the browser/webview
// blocks it outright (confirmed live: identical failure reproduces
// from a local Vite dev server, which is cross-origin to this API in
// exactly the same way). These are public, read-only, unauthenticated
// proxies with no cookies or credentials involved, so an open
// Access-Control-Allow-Origin is the correct fix, not a shortcut.
export function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}
