// Client-side helper for TMDB's real movie/TV database. See api/tmdb.js
// for field-verification notes.
//
// Movies use `title`/`release_date`, TV shows use `name`/`first_air_date`
// — standard TMDB convention. Normalized here so the rest of the app
// doesn't need to care which media type it's dealing with, but reading
// both field names defensively rather than assuming TV matches the
// (only actually-confirmed) movie response shape exactly.

import { API_BASE } from "./apiBase";

const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

function normalizeResult(item, mediaKind) {
  return {
    id: item.id,
    title: item.title || item.name || "",
    overview: item.overview || "",
    releaseDate: item.release_date || item.first_air_date || null,
    posterUrl: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    voteAverage: item.vote_average ?? null,
    mediaKind,
  };
}

export async function searchMovies(query) {
  const res = await fetch(`${API_BASE}/api/tmdb?mode=search-movie&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return (data.results || []).map((r) => normalizeResult(r, "movie"));
}

export async function searchTv(query) {
  const res = await fetch(`${API_BASE}/api/tmdb?mode=search-tv&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return (data.results || []).map((r) => normalizeResult(r, "tv"));
}
