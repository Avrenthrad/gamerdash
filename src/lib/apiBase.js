// Configurable API base URL.
//
// Defaults to an empty string — relative paths like `/api/steam`,
// which work correctly for the normal web deployment (the same
// origin serves both the app and its /api/* functions).
//
// Packaged desktop (Tauri) and mobile (Capacitor) builds load from a
// local file origin instead of a live server, so a relative /api/
// path has nothing to resolve against there. Those builds need this
// set to the real deployed URL, e.g.
//   VITE_API_BASE_URL=https://lykodex.vercel.app
// via a build-time env var — everywhere in the app that calls a
// Lykodex API route imports API_BASE and prefixes with it, so
// flipping this one value is the only change needed to make a
// packaged build work, not a per-file rewrite.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
