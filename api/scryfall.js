// Vercel serverless function — proxies Scryfall's real, official Magic:
// The Gathering card API. Genuinely free, no key required at all —
// "No API key, no paid tier — usage is governed by attribution and a
// documented rate-limit policy." Confirmed field/endpoint names
// against Scryfall's own docs and a real OpenAPI schema rather than
// guessing (learned that lesson the hard way with Fortnite earlier
// in this project).
//
// Proxied anyway (even though no key needs protecting) purely for
// architectural consistency with every other integration in this
// project, and so caching/error-handling stays in one place.
//
// Attribution requirement: Scryfall asks that apps using their data
// link back to them — handled in the frontend UI, not here.
//
// Usage from the frontend:
//   fetch("/api/scryfall?mode=search&q=...")
//   fetch("/api/scryfall?mode=named&exact=...")
//   fetch("/api/scryfall?mode=autocomplete&q=...")
//   fetch("/api/scryfall?mode=card&id=...")
//   fetch("/api/scryfall?mode=set&code=...")

const BASE_URL = "https://api.scryfall.com";

// Scryfall rejects requests with no User-Agent (or a bare default one
// from the HTTP client) with a 400 — confirmed live, not documented
// anywhere obvious. Every request needs both of these headers.
const SCRYFALL_HEADERS = {
  "User-Agent": "Lykodex/1.0 (+https://gamerdash.vercel.app)",
  Accept: "application/json",
};

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const page = searchParams.get("page") || "1";
      // "cards" (default) collapses functionally-identical reprints;
      // "prints" returns every real printing — needed for a set's
      // full checklist (alternate arts/borderless are distinct cards
      // even within one set). Both are genuine Scryfall `unique`
      // values, not invented.
      const unique = searchParams.get("unique") === "prints" ? "prints" : "cards";
      const scryRes = await fetch(`${BASE_URL}/cards/search?q=${encodeURIComponent(q)}&page=${page}&unique=${unique}`, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      // Scryfall returns a real 404 with a JSON error body when a
      // search has zero matches — not a failure on our end, just an
      // empty result the frontend should treat as "no cards found".
      if (scryRes.status === 404) return res.status(200).json({ data: [], total_cards: 0 });
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Scryfall search failed" });
      return res.status(200).json(data);
    }

    if (mode === "named") {
      const exact = searchParams.get("exact");
      if (!exact) return res.status(400).json({ error: "Missing exact query parameter" });
      // Optional `set` narrows to that specific printing — real,
      // documented Scryfall param, verified live against
      // api.scryfall.com/cards/named?exact=...&set=... — used by CSV
      // import to match the exact edition a row specifies rather than
      // just whatever printing Scryfall considers "default".
      const set = searchParams.get("set");
      const url = `${BASE_URL}/cards/named?exact=${encodeURIComponent(exact)}${set ? `&set=${encodeURIComponent(set)}` : ""}`;
      const scryRes = await fetch(url, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Card not found" });
      return res.status(200).json(data);
    }

    if (mode === "autocomplete") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const scryRes = await fetch(`${BASE_URL}/cards/autocomplete?q=${encodeURIComponent(q)}`, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      return res.status(200).json(data);
    }

    if (mode === "card") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const scryRes = await fetch(`${BASE_URL}/cards/${id}`, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Card not found" });
      return res.status(200).json(data);
    }

    // Every real Scryfall set (paper + digital-only) — powers the "pick
    // a set" search when starting a new set list. One request, cached
    // client-side, rather than hammering a per-keystroke search.
    if (mode === "sets") {
      const scryRes = await fetch(`${BASE_URL}/sets`, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Failed to list sets" });
      return res.status(200).json(data);
    }

    // Set metadata for TCG binders' "set list" kind — real Set object
    // (name, card_count, released_at, icon_svg_uri, etc.), field names
    // verified live against https://api.scryfall.com/sets/<code>.
    if (mode === "set") {
      const code = searchParams.get("code");
      if (!code) return res.status(400).json({ error: "Missing code query parameter" });
      const scryRes = await fetch(`${BASE_URL}/sets/${encodeURIComponent(code)}`, { headers: SCRYFALL_HEADERS });
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Set not found" });
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("scryfall proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
