// Client-side helper for AniList's real anime GraphQL API. See
// api/anilist.js for field-verification notes.

import { API_BASE } from "./apiBase";

function normalizeResult(item) {
  const year = item.startDate?.year;
  return {
    id: item.id,
    title: item.title?.english || item.title?.romaji || item.title?.native || "",
    // AniList descriptions commonly include raw <br> and other HTML
    // tags — stripped here rather than dangerouslySetInnerHTML'd.
    overview: (item.description || "").replace(/<[^>]+>/g, ""),
    releaseDate: year ? String(year) : null,
    posterUrl: item.coverImage?.large || item.coverImage?.medium || null,
    voteAverage: item.averageScore != null ? item.averageScore / 10 : null, // AniList scores out of 100, normalize to /10 to match TMDB's scale
    genres: item.genres || [],
    mediaKind: "anime",
  };
}

export async function searchAnime(query) {
  const res = await fetch(`${API_BASE}/api/anilist?mode=search&q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(normalizeResult);
}
