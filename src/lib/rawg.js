// Client-side helper for RAWG's real game database (upcoming releases,
// DLC/expansions, genres, platforms). See api/rawg.js for field-name
// verification notes and the attribution requirement.
//
// One honest gap: RAWG's general /games list endpoint doesn't cleanly
// expose "is this specific result a DLC/addition" — it only has a
// documented exclude_additions toggle to filter them OUT entirely.
// So general browse only offers New Games / Everything as the release
// type, not a standalone "DLC only" view — reliable per-title DLC
// data only exists via the per-game /additions endpoint, which is
// what the personalized (logged-in) path uses against the person's
// own wishlist/library/backlog titles instead of guessing at scale.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

export async function fetchRawgPlatforms() {
  const cacheKey = "gd-rawg-platforms";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_WEEK);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/rawg?mode=platforms`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const list = data.results || [];
  setCached(cacheKey, list);
  return list; // [{ id, name }, ...]
}

export async function fetchRawgGenres() {
  const cacheKey = "gd-rawg-genres";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_WEEK);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/rawg?mode=genres`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const list = data.results || [];
  setCached(cacheKey, list);
  return list; // [{ id, name }, ...]
}

export async function fetchUpcomingReleases({ dateFrom, dateTo, platformId, genreId, excludeAdditions }) {
  const params = new URLSearchParams({ mode: "upcoming", dateFrom, dateTo });
  if (platformId) params.set("platforms", platformId);
  if (genreId) params.set("genres", genreId);
  if (excludeAdditions) params.set("excludeAdditions", "true");

  const res = await fetch(`${API_BASE}/api/rawg?${params.toString()}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";

  // Deliberately not attempting to flag which of these results are
  // DLC/additions individually — RAWG's general list response doesn't
  // cleanly expose that per-entry, only the confirmed
  // exclude_additions toggle for filtering them out entirely. Rather
  // than guess, "Release type" in the browse UI only offers New
  // Games / Everything — reliable "is this DLC" data only exists
  // per-game via /additions, used by the personalized path below.
  return (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    released: g.released,
    backgroundImage: g.background_image,
    metacritic: g.metacritic,
    platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
  }));
}

export async function searchRawgGame(title) {
  const res = await fetch(`${API_BASE}/api/rawg?mode=search&q=${encodeURIComponent(title)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return data.results?.[0] || null; // best match, or null
}

// Up to 8 matches, each with its real list of platforms (from RAWG's
// own catalog, not guessed) — powers Backlog's "add from any
// platform" search, since Steam's own search only ever finds Steam
// titles and misses anything console-exclusive.
export async function searchRawgGames(title) {
  const res = await fetch(`${API_BASE}/api/rawg?mode=search&q=${encodeURIComponent(title)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    backgroundImage: g.background_image,
    metacritic: g.metacritic,
    platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
  }));
}

export async function fetchAdditionsForGame(gameId) {
  const cacheKey = `gd-rawg-additions:${gameId}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/rawg?mode=additions&gameId=${gameId}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const list = (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    released: g.released,
    backgroundImage: g.background_image,
    tba: g.tba,
  }));
  setCached(cacheKey, list);
  return list;
}

// For logged-in users: cross-references their own games (wishlist +
// library + backlog titles, already deduplicated by the caller)
// against RAWG to find upcoming DLC/expansions specifically for
// titles they actually own or care about — much more reliable than
// trying to guess at DLC across the whole general catalog.
export async function fetchUpcomingDlcForTitles(titles) {
  const uniqueTitles = [...new Set(titles)];
  const results = await Promise.all(
    uniqueTitles.map(async (title) => {
      try {
        const match = await searchRawgGame(title);
        if (match === "no_key" || !match) return [];
        const additions = await fetchAdditionsForGame(match.id);
        if (additions === "no_key") return [];
        return additions
          .filter((a) => a.tba || (a.released && new Date(a.released) >= new Date()))
          .map((a) => ({ ...a, parentTitle: title }));
      } catch (err) {
        console.error(`DLC lookup failed for "${title}":`, err);
        return [];
      }
    })
  );
  return results.flat().sort((a, b) => new Date(a.released || "9999-12-31") - new Date(b.released || "9999-12-31"));
}
