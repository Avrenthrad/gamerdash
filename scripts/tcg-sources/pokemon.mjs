// Pokémon TCG source adapter — pokemontcg.io's real /v2/cards listing,
// paginated (confirmed live: page/pageSize, totalCount in the
// response). One entry per printing already (card.id is printing-
// specific, e.g. "hgss4-1"), so no separate dedup step is needed the
// way Scryfall's unique_artwork bulk file provides for MTG.

import { fetchWithRetry, USER_AGENT_HEADERS } from "./http.mjs";

export const GAME_ID = "pokemon";

// Smaller than MTG/FAB's page sizes deliberately — pokemontcg.io's
// unauthenticated tier (no POKEMON_TCG_API_KEY is configured for this
// project — see api/pokemon.js) 500/502s intermittently regardless of
// pacing, confirmed live across several full runs, worse at pageSize
// 250 than smaller pages.
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 1500;
// Backend flakiness here isn't the fast-transient kind fetchWithRetry
// already covers (a few hundred ms to a couple seconds) — confirmed
// live it needs real recovery time, so this is its own slower, longer
// outer retry around each page specifically, not just more attempts
// at the same cadence.
const PAGE_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 90000];

async function fetchPage(page) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: USER_AGENT_HEADERS,
      });
      return await res.json();
    } catch (err) {
      if (i >= PAGE_RETRY_DELAYS_MS.length) throw err;
      console.error(`Page ${page} failed (${err.message}), retrying in ${PAGE_RETRY_DELAYS_MS[i] / 1000}s...`);
      await new Promise((r) => setTimeout(r, PAGE_RETRY_DELAYS_MS[i]));
    }
  }
}

export async function* iterateCards() {
  let page = 1;
  for (;;) {
    if (page > 1) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    const json = await fetchPage(page);
    const cards = json.data || [];
    if (cards.length === 0) return;

    for (const card of cards) {
      const imageUrl = card.images?.small;
      if (!imageUrl) continue;
      yield {
        id: card.id,
        name: card.name,
        set: card.set?.id || "",
        imageUrl,
      };
    }

    if (page * PAGE_SIZE >= json.totalCount) return;
    page += 1;
  }
}
