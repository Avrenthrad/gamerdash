// Vercel serverless function — proxies TMDB's real, official movie/TV
// database API. Confirmed field names (title, overview, poster_path,
// release_date, vote_average, id) directly against real response
// examples, not guessed from memory.
//
// Free for non-commercial use; commercial use needs a separate
// written agreement with TMDB — worth knowing if this app ever
// monetizes. Auth is a simple api_key query param (v3), same simple
// pattern as every other integration in this project.

import { allowCors } from "./_cors.js";

const BASE_URL = "https://api.themoviedb.org/3";

export default async function handler(req, res) {
  allowCors(res);
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: "no_key" });
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search-movie" || mode === "search-tv") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const endpoint = mode === "search-movie" ? "search/movie" : "search/tv";
      const tmdbRes = await fetch(`${BASE_URL}/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(q)}`);
      if (!tmdbRes.ok) return res.status(502).json({ error: "TMDB search failed." });
      const data = await tmdbRes.json();
      return res.status(200).json(data);
    }

    if (mode === "movie-details" || mode === "tv-details") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const endpoint = mode === "movie-details" ? "movie" : "tv";
      const tmdbRes = await fetch(`${BASE_URL}/${endpoint}/${encodeURIComponent(id)}?api_key=${apiKey}`);
      if (!tmdbRes.ok) return res.status(502).json({ error: "Failed to load TMDB details." });
      const data = await tmdbRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("tmdb proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
