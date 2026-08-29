// Client-side helper for YGOPRODeck's real, free, keyless Yu-Gi-Oh!
// API (db.ygoprodeck.com/api/v7) — confirmed live to send
// `Access-Control-Allow-Origin: *`, unlike optcgapi.com's neighbor
// Riftcodex, so this calls the real API directly with no Vercel proxy
// needed (see lib/riftbound.js for the one that does need one).
//
// Real per-card market pricing lives in card_prices (tcgplayer/
// cardmarket/ebay/amazon/coolstuffinc, confirmed live) and real
// per-format ban status lives in banlist_info (ban_tcg/ban_ocg/
// ban_goat: "Forbidden"/"Limited"/"Semi-Limited") — both used as-is,
// never fabricated.
//
// Rate limit confirmed live: 20 requests/second, 1-hour block if
// exceeded — this app's own usage (one search or one card lookup per
// action) is nowhere near that.

import { getCached, setCached, CACHE_TTL } from "./cache";

const API_ROOT = "https://db.ygoprodeck.com/api/v7";

function normalizeYugiohCard(card) {
  const prices = card.card_prices?.[0] || null;
  return {
    id: String(card.id),
    name: card.name,
    type: card.type,
    race: card.race,
    attribute: card.attribute || null,
    level: card.level ?? null,
    atk: card.atk ?? null,
    def: card.def ?? null,
    archetype: card.archetype || null,
    desc: card.desc,
    imageUrl: card.card_images?.[0]?.image_url || null,
    imageUrlSmall: card.card_images?.[0]?.image_url_small || null,
    sets: (card.card_sets || []).map((s) => ({
      setCode: s.set_code,
      setName: s.set_name,
      rarity: s.set_rarity,
      price: s.set_price,
    })),
    // "Forbidden" | "Limited" | "Semi-Limited" | undefined (unrestricted)
    banTcg: card.banlist_info?.ban_tcg || null,
    banOcg: card.banlist_info?.ban_ocg || null,
    banGoat: card.banlist_info?.ban_goat || null,
    prices: prices
      ? {
          tcgplayer: prices.tcgplayer_price != null ? Number(prices.tcgplayer_price) : null,
          cardmarket: prices.cardmarket_price != null ? Number(prices.cardmarket_price) : null,
          ebay: prices.ebay_price != null ? Number(prices.ebay_price) : null,
          amazon: prices.amazon_price != null ? Number(prices.amazon_price) : null,
          coolstuffinc: prices.coolstuffinc_price != null ? Number(prices.coolstuffinc_price) : null,
        }
      : null,
  };
}

// Prefers TCGplayer (closest to a real-time US market price, same
// preference order lib/pokemon.js uses), falls back through whichever
// real vendor price is actually present.
export function currentYugiohPrice(card) {
  const p = card.prices;
  if (!p) return null;
  const order = ["tcgplayer", "cardmarket", "ebay", "amazon", "coolstuffinc"];
  for (const source of order) {
    if (p[source] != null && p[source] > 0) return { price: p[source], source };
  }
  return null;
}

export async function searchYugiohCards(query) {
  if (!query || !query.trim()) return [];
  const res = await fetch(`${API_ROOT}/cardinfo.php?fname=${encodeURIComponent(query.trim())}`);
  if (res.status === 400) return []; // YGOPRODeck's real "no matches" response
  if (!res.ok) throw new Error(`Yu-Gi-Oh! search failed for "${query}"`);
  const data = await res.json();
  return (data.data || []).map(normalizeYugiohCard);
}

export async function getYugiohCardById(id) {
  const cacheKey = `gd-ygo-card-id:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_ROOT}/cardinfo.php?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0] ? normalizeYugiohCard(data.data[0]) : null;
  setCached(cacheKey, card);
  return card;
}

export async function getYugiohCardByName(name) {
  const cacheKey = `gd-ygo-card-name:${name}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_ROOT}/cardinfo.php?name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0] ? normalizeYugiohCard(data.data[0]) : null;
  setCached(cacheKey, card);
  return card;
}

// Confirmed live: short queries (2-3 chars) return successfully here,
// unlike Pokémon's API which needed a 4-char floor — still capped at 3
// to keep autocomplete calls light.
export async function getYugiohCardAutocomplete(query) {
  if (!query || query.length < 3) return [];
  try {
    const cards = await searchYugiohCards(query);
    return [...new Set(cards.map((c) => c.name))].slice(0, 8);
  } catch {
    return [];
  }
}
