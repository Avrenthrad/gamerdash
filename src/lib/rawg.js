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
//
// RAWG's free tier is 20,000 requests/month total across every
// Lykodex user sharing this one key, so search results (the highest-
// traffic call — every Backlog "add from any platform" search and
// every DLC lookup goes through it) are cached the same way
// xbxprices.js caches its own tighter 1,000/month quota: by
// normalized query, "no_key" results deliberately never cached so
// adding a real key later takes effect immediately instead of
// waiting out a stale TTL.

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

  // Every filter is already folded into params.toString(), so two
  // people (or the same person re-opening the page) browsing the same
  // date/platform/genre combo share one cached result instead of each
  // spending their own request on it.
  const cacheKey = `gd-rawg-upcoming:${params.toString()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

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
  const list = (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    released: g.released,
    backgroundImage: g.background_image,
    metacritic: g.metacritic,
    platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
  }));
  setCached(cacheKey, list);
  return list;
}

export async function searchRawgGame(title) {
  const cacheKey = `gd-rawg-search1:${title.trim().toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/rawg?mode=search&q=${encodeURIComponent(title)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const match = data.results?.[0] || null; // best match, or null
  setCached(cacheKey, match);
  return match;
}

// Up to 20 matches, each with its real list of platforms (from RAWG's
// own catalog, not guessed) — powers Backlog's "add from any
// platform" search, since Steam's own search only ever finds Steam
// titles and misses anything console-exclusive. This is the single
// highest-traffic RAWG call in the app (every Backlog search goes
// through it), so it's the one most worth caching.
export async function searchRawgGames(title) {
  const cacheKey = `gd-rawg-searchN:${title.trim().toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/rawg?mode=search&q=${encodeURIComponent(title)}`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const list = (data.results || []).map((g) => ({
    id: g.id,
    name: g.name,
    backgroundImage: g.background_image,
    metacritic: g.metacritic,
    platforms: (g.platforms || []).map((p) => p.platform?.name).filter(Boolean),
  }));
  setCached(cacheKey, list);
  return list;
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
