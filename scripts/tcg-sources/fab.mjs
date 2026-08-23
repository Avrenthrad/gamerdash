// Flesh and Blood source adapter — goagain.dev's real /v1/cards
// listing, paginated with limit/offset (confirmed live: { data, total,
// limit, offset }, not page-based like the other two games).
//
// Each card entry already embeds its own printings[] array inline
// (confirmed live) — no separate per-card detail fetch needed. Every
// printing gets its own index entry rather than just the first one:
// unlike MTG's unique_artwork scope (one art per card), the same FAB
// card can look meaningfully different across editions/foilings
// (different border art, foil sheen), and a person's physical copy
// could be any one of those — matching only the "first" printing would
// silently miss real cards someone actually scans.

import { fetchWithRetry, USER_AGENT_HEADERS } from "./http.mjs";

export const GAME_ID = "fab";

const LIMIT = 100;

export async function* iterateCards() {
  let offset = 0;
  for (;;) {
    const res = await fetchWithRetry(`https://api.goagain.dev/v1/cards?limit=${LIMIT}&offset=${offset}`, {
      headers: USER_AGENT_HEADERS,
    });
    const json = await res.json();
    const cards = json.data || [];
    if (cards.length === 0) return;

    for (const card of cards) {
      for (const printing of card.printings || []) {
        if (!printing.image_url) continue;
        yield {
          id: printing.unique_id,
          name: card.name,
          set: printing.set_id || "",
          imageUrl: printing.image_url,
        };
      }
    }

    offset += LIMIT;
    if (offset >= json.total) return;
  }
}
