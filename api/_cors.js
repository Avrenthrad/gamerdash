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
// exactly the same way). Most of these proxies are public, read-only,
// unauthenticated calls with no custom headers — a "simple" CORS
// request, where Access-Control-Allow-Origin alone is enough.
//
// Xbox/PSN linking are different: they're POSTs carrying a real
// `Authorization: Bearer <supabase-token>` header (see xboxOAuth.js/
// psnAuth.js's callXboxService/callPsnService), which is a non-simple
// request — the browser sends a CORS preflight OPTIONS first, and
// without Access-Control-Allow-Headers/-Methods on that preflight
// response the browser blocks the real request before it's ever sent.
// On the web deployment this never surfaced: API_BASE is "" there, so
// the call is same-origin and no preflight happens at all — it only
// reproduces cross-origin, i.e. from a packaged desktop/mobile build
// (confirmed live: "Failed to fetch" linking PSN from the desktop
// app). Setting these two on every response, and letting the handler
// short-circuit actual OPTIONS requests, covers both cases.
export function allowCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
