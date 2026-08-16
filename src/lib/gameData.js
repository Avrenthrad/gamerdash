// Orchestrates finding a game and pricing it — this is the actual fix
// for "all our eggs in one basket" with CheapShark.
//
// Old flow: CheapShark's title search found the game AND priced it.
// If CheapShark had any problem (rate limiting, an outage), the whole
// card broke — even the Steam price, which didn't need CheapShark at
// all.
//
// New flow: Steam's own search finds the game first (name, thumbnail,
// App ID). CheapShark is then only asked for GOG/Epic/Humble pricing,
// looked up precisely by that Steam App ID rather than a fuzzy title
// match. If CheapShark fails now, Steam-sourced data (price, name,
// thumbnail, player count, Metacritic, reviews — all fetched
// separately, elsewhere) is completely unaffected. Only the
// GOG/Epic/Humble chips degrade gracefully to "not sold here" instead
// of the whole card erroring out.

import { searchSteamGames } from "./steam";
import { fetchDealBySteamAppId, fetchDealByTitle } from "./cheapshark";
import { getCached, setCached, CACHE_TTL } from "./cache";

function buildFromSteamMatch(match, cheapSharkDeal) {
  return {
    game: match.name,
    thumb: match.tiny_image || cheapSharkDeal?.thumb || null,
    stores: cheapSharkDeal?.stores || [],
    lowest: cheapSharkDeal?.lowest ?? null,
    lowestDate: cheapSharkDeal?.lowestDate ?? "—",
    steamAppID: match.id,
  };
}

// Give it a game title, get back one normalized deal object.
// Cached 24h in localStorage (persists across sessions, not just the
// current tab) — this is what actually protects against CheapShark's
// rate limiter, which this project has hit before from exactly this
// pattern: reloading the page repeatedly re-requests the same games.
export async function fetchGameDeal(title) {
  const cacheKey = `gd-deal:${title.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const deal = await fetchGameDealUncached(title);
  if (deal) setCached(cacheKey, deal);
  return deal;
}

async function fetchGameDealUncached(title) {
  let steamMatch = null;
  try {
    const matches = await searchSteamGames(title);
    steamMatch = matches[0] || null;
  } catch (err) {
    console.error("Steam search failed, falling back to CheapShark's own search:", err);
  }

  if (steamMatch) {
    let cheapSharkDeal = null;
    try {
      cheapSharkDeal = await fetchDealBySteamAppId(steamMatch.id);
    } catch (err) {
      console.error("GOG/Epic/Humble pricing unavailable for this title:", err);
    }
    return buildFromSteamMatch(steamMatch, cheapSharkDeal);
  }

  // Not found on Steam at all (some DLC / non-Steam titles) — fall
  // back to CheapShark's own title search, the one case it's still
  // genuinely needed for discovery.
  return fetchDealByTitle(title);
}

// Give it a search query, get back the closest 1–6 normalized results.
export async function fetchGameDeals(query, limit = 6) {
  let steamMatches = [];
  try {
    steamMatches = (await searchSteamGames(query)).slice(0, limit);
  } catch (err) {
    console.error("Steam search failed:", err);
  }

  if (steamMatches.length === 0) {
    const fallback = await fetchDealByTitle(query);
    return fallback ? [fallback] : [];
  }

  const deals = await Promise.all(
    steamMatches.map(async (match) => {
      let cheapSharkDeal = null;
      try {
        cheapSharkDeal = await fetchDealBySteamAppId(match.id);
      } catch {
        // GOG/Epic/Humble just won't show for this one — not fatal.
      }
      return buildFromSteamMatch(match, cheapSharkDeal);
    })
  );
  return deals;
}
