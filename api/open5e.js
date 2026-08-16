// Vercel serverless function — proxies Open5e's real, open-source D&D
// 5e SRD API. Genuinely free, no API key needed at all, no auth.
// Confirmed real field names (slug, name, desc, level, school for
// spells; slug, desc, CR, type for monsters) against real response
// examples, not guessed from memory.
//
// Scoped to D&D 5e only — the one tabletop system with a genuine,
// legitimate open API. Other systems (PF2e, Daggerheart, Cyberpunk
// Red, wargames) have no equivalent and get honest link-out/notes
// treatment in the UI instead of a fake lookup.

const BASE_URL = "https://api.open5e.com/v1";

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search-spells" || mode === "search-monsters") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const endpoint = mode === "search-spells" ? "spells" : "monsters";
      const olRes = await fetch(`${BASE_URL}/${endpoint}/?search=${encodeURIComponent(q)}&limit=10`);
      const data = await olRes.json();
      return res.status(200).json({ results: data.results || [] });
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("open5e proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
