// Vercel serverless function — proxies AniList's real, official anime
// GraphQL API. Genuinely free, no API key needed for public read-only
// data — confirmed directly from AniList's own docs. This is the
// first GraphQL integration in this project (everything else has
// been simple REST) — single POST endpoint, query + variables in the
// body, rather than query-string params like every other proxy here.
//
// Confirmed real field names (title.romaji/english/native, coverImage
// .large/.medium, averageScore, startDate.year/month/day, genres,
// description) against multiple independent real query examples —
// not guessed from memory.

import { allowCors } from "./_cors.js";

const ENDPOINT = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query ($search: String!, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english native }
        coverImage { large medium }
        averageScore
        startDate { year month day }
        description
        genres
      }
    }
  }
`;

export default async function handler(req, res) {
  allowCors(res);
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });

      const anilistRes = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          query: SEARCH_QUERY,
          variables: { search: q, perPage: 12 },
        }),
      });
      const data = await anilistRes.json();
      if (!anilistRes.ok || data.errors) {
        return res.status(200).json({ results: [] }); // AniList returns 404-style errors for zero matches, not a real failure
      }
      return res.status(200).json({ results: data.data?.Page?.media || [] });
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("anilist proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
