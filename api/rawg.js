// Vercel serverless function — proxies RAWG's real, official game
// database API (500,000+ games, real release dates per platform,
// genres, DLC/expansion relationships). Confirmed field/param names
// against RAWG's actual API docs (rawg.io/apidocs) rather than
// guessing from marketing copy.
//
// IMPORTANT — RAWG's free tier requires attribution: an active
// hyperlink back to RAWG on every page that shows their data. The
// frontend handles this (see the credit line on UpcomingReleasesPage) —
// don't remove it if you're touching that page.
//
// Usage from the frontend:
//   fetch("/api/rawg?mode=platforms")
//   fetch("/api/rawg?mode=genres")
//   fetch("/api/rawg?mode=upcoming&dateFrom=...&dateTo=...&platforms=...&genres=...&excludeAdditions=true")
//   fetch("/api/rawg?mode=search&q=...")
//   fetch("/api/rawg?mode=additions&gameId=...")

const BASE_URL = "https://api.rawg.io/api";

export default async function handler(req, res) {
  const apiKey = process.env.RAWG_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: "no_key" });
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "platforms") {
      const rawgRes = await fetch(`${BASE_URL}/platforms?key=${apiKey}&page_size=50`);
      const data = await rawgRes.json();
      return res.status(200).json(data);
    }

    if (mode === "genres") {
      const rawgRes = await fetch(`${BASE_URL}/genres?key=${apiKey}&page_size=50`);
      const data = await rawgRes.json();
      return res.status(200).json(data);
    }

    if (mode === "upcoming") {
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      const platforms = searchParams.get("platforms"); // comma-separated RAWG platform IDs
      const genres = searchParams.get("genres"); // comma-separated RAWG genre IDs
      const excludeAdditions = searchParams.get("excludeAdditions");

      const params = new URLSearchParams({
        key: apiKey,
        dates: `${dateFrom},${dateTo}`,
        ordering: "released",
        page_size: "40",
      });
      if (platforms) params.set("platforms", platforms);
      if (genres) params.set("genres", genres);
      if (excludeAdditions === "true") params.set("exclude_additions", "true");

      const rawgRes = await fetch(`${BASE_URL}/games?${params.toString()}`);
      const data = await rawgRes.json();
      return res.status(200).json(data);
    }

    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const rawgRes = await fetch(`${BASE_URL}/games?key=${apiKey}&search=${encodeURIComponent(q)}&page_size=20`);
      const data = await rawgRes.json();
      return res.status(200).json(data);
    }

    if (mode === "additions") {
      const gameId = searchParams.get("gameId");
      if (!gameId) return res.status(400).json({ error: "Missing gameId query parameter" });
      const rawgRes = await fetch(`${BASE_URL}/games/${gameId}/additions?key=${apiKey}&page_size=20`);
      const data = await rawgRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("rawg proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
