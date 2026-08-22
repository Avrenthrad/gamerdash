// Client-side helper for Discogs' real music/vinyl database —
// confirmed live that api.discogs.com sends
// `access-control-allow-origin: *`, so this is called DIRECTLY from
// the browser with no /api/* proxy needed at all (unlike every other
// external API this project talks to, which all need proxying either
// to hide a key or because the upstream blocks direct browser
// requests — Discogs does neither). Genuinely keyless: confirmed live
// that a real search succeeds with no token/auth at all, so vinyl
// lookup needs zero setup, unlike Rebrickable's LEGO lookup.
//
// User-Agent is set per Discogs' own guidance for identifying API
// clients, but not depended on — confirmed live that a request
// without a custom one still succeeds, and browsers may silently
// override this header anyway.
//
// Real, confirmed limitation: unauthenticated search results always
// have blank thumb/cover_image fields (checked across many real
// results, every single one was ""), so imageUrl below will
// consistently be null — a real Discogs personal token would unlock
// real cover art, but isn't required for the search/metadata itself
// to work. The UI's existing "only render an image if one exists"
// pattern already handles this honestly (no thumbnail, not a broken one).

const BASE_URL = "https://api.discogs.com";
const HEADERS = { "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)" };

function normalizeRelease(r) {
  return {
    id: r.id,
    title: r.title, // Discogs' own "Artist - Title" combined format
    year: r.year || null,
    imageUrl: r.cover_image || r.thumb || null,
    format: (r.format || []).join(", "),
    label: (r.label || [])[0] || null,
  };
}

// Vinyl-specific by default (format=vinyl) — this is the vinyl/music
// lookup for the Collectibles "Media & Editions" type, not a general
// Discogs browser.
export async function searchDiscogsVinyl(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({ q: trimmed, type: "release", format: "vinyl", per_page: "20" });
  const res = await fetch(`${BASE_URL}/database/search?${params.toString()}`, { headers: HEADERS });
  if (!res.ok) throw new Error("Discogs search failed");
  const data = await res.json();
  return (data.results || []).map(normalizeRelease);
}
