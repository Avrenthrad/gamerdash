// Pokémon TCG source adapter — pokemontcg.io's real /v2/cards listing,
// paginated (confirmed live: page/pageSize, totalCount in the
// response). One entry per printing already (card.id is printing-
// specific, e.g. "hgss4-1"), so no separate dedup step is needed the
// way Scryfall's unique_artwork bulk file provides for MTG.

import { fetchWithRetry, USER_AGENT_HEADERS } from "./http.mjs";

export const GAME_ID = "pokemon";

const PAGE_SIZE = 250;

// pokemontcg.io's unauthenticated rate limit is aggressive enough that
// paging through with zero delay reliably starts 500ing after only a
// handful of requests (confirmed live) — no POKEMON_TCG_API_KEY is
// configured for this project (see api/pokemon.js), so pacing page
// requests is the honest workaround rather than hammering an
// unauthenticated free tier as fast as fetchWithRetry's backoff allows.
const PAGE_DELAY_MS = 1500;

export async function* iterateCards() {
  let page = 1;
  for (;;) {
    if (page > 1) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    const res = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${PAGE_SIZE}`, {
      headers: USER_AGENT_HEADERS,
    });
    const json = await res.json();
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
