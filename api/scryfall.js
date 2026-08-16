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

const BASE_URL = "https://api.scryfall.com";

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const page = searchParams.get("page") || "1";
      const scryRes = await fetch(`${BASE_URL}/cards/search?q=${encodeURIComponent(q)}&page=${page}`);
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
      const scryRes = await fetch(`${BASE_URL}/cards/named?exact=${encodeURIComponent(exact)}`);
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Card not found" });
      return res.status(200).json(data);
    }

    if (mode === "autocomplete") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const scryRes = await fetch(`${BASE_URL}/cards/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await scryRes.json();
      return res.status(200).json(data);
    }

    if (mode === "card") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const scryRes = await fetch(`${BASE_URL}/cards/${id}`);
      const data = await scryRes.json();
      if (!scryRes.ok) return res.status(scryRes.status).json({ error: data.details || "Card not found" });
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("scryfall proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
