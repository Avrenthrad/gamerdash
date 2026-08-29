// Client-side helper for optcgapi.com's real, free, keyless One Piece
// Card Game API — confirmed live to send
// `Access-Control-Allow-Origin: *`, so this calls the real API
// directly with no Vercel proxy needed (see lib/riftbound.js for the
// neighbor TCG that does need one). Covers OP-01 through the current
// English-release sets plus starter decks, per the API's own scope.
//
// Real per-card market/inventory pricing is included directly on the
// card object (market_price/inventory_price, refreshed daily per the
// API's own docs) — used as-is, never fabricated.

import { getCached, setCached, CACHE_TTL } from "./cache";

const API_ROOT = "https://optcgapi.com/api";

// card_image_id (not card_set_id) is the real unique-per-printing
// identifier — confirmed live that a Parallel/Alternate Art variant
// shares the SAME card_set_id as its base printing (e.g. both
// "Monkey.D.Luffy (024)" and "Monkey.D.Luffy (024) (Parallel)" have
// card_set_id "OP01-024"), which produced real duplicate React keys
// and duplicate collection rows when card_set_id was used as `id`.
// card_image_id is genuinely distinct per variant ("OP01-024" vs
// "OP01-024_p1")... except optcgapi.com's own dataset ALSO has a
// handful of confirmed real collisions where card_image_id repeats
// across two entirely DIFFERENT cards (e.g. "OP03-070" is shared by
// "Monkey.D.Luffy (Dash Pack)" from Kingdoms of Intrigue and an
// unrelated "Monkey.D.Luffy" from Pillars of Strength) — a genuine
// upstream data-quality issue, not something fixable from this side.
// Search-result rendering keys on `${id}-${index}` to stay stable
// despite this; getOnePieceCardById below can't fully disambiguate a
// collision like this, so collection-adding one of a colliding pair
// is a known, documented edge case rather than a silent bug.
function normalizeOnePieceCard(card) {
  return {
    id: card.card_image_id,
    cardSetId: card.card_set_id,
    name: card.card_name,
    text: card.card_text,
    setId: card.set_id,
    setName: card.set_name,
    rarity: card.rarity,
    color: card.card_color,
    type: card.card_type, // "Leader" | "Character" | "Event" | "Stage"
    life: card.life,
    cost: card.card_cost,
    power: card.card_power,
    counter: card.counter_amount,
    attribute: card.attribute,
    subTypes: card.sub_types,
    imageUrl: card.card_image,
    marketPrice: card.market_price != null ? Number(card.market_price) : null,
    inventoryPrice: card.inventory_price != null ? Number(card.inventory_price) : null,
  };
}

// Real market price preferred over the API's own "inventory" figure
// (a listing-price estimate, not a real transacted-market number) —
// same "prefer the more market-real figure" rule lib/pokemon.js and
// lib/yugioh.js both follow.
export function currentOnePiecePrice(card) {
  if (card.marketPrice != null && card.marketPrice > 0) return { price: card.marketPrice, source: "optcgapi" };
  if (card.inventoryPrice != null && card.inventoryPrice > 0) return { price: card.inventoryPrice, source: "optcgapi" };
  return null;
}

export async function searchOnePieceCards(query) {
  if (!query || !query.trim()) return [];
  const res = await fetch(`${API_ROOT}/sets/filtered/?card_name=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error(`One Piece TCG search failed for "${query}"`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(normalizeOnePieceCard);
}

// Takes a card_image_id (this module's real per-printing id — see
// normalizeOnePieceCard above), not a card_set_id — the lookup
// endpoint only accepts card_set_id, so the base id is recovered by
// stripping any trailing "_p..." variant suffix, then the matching
// row is picked out of the (possibly multi-variant) response by its
// own card_image_id rather than assuming data[0] is the right one.
export async function getOnePieceCardById(cardImageId) {
  const cacheKey = `gd-optcg-card-id:${cardImageId}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const baseCardSetId = cardImageId.split("_")[0];
  const res = await fetch(`${API_ROOT}/sets/card/${encodeURIComponent(baseCardSetId)}/`);
  if (!res.ok) return null;
  const data = await res.json();
  const match = Array.isArray(data) ? data.find((c) => c.card_image_id === cardImageId) : null;
  const card = match ? normalizeOnePieceCard(match) : null;
  setCached(cacheKey, card);
  return card;
}

export async function getAllOnePieceSets() {
  const cacheKey = "gd-optcg-all-sets";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_ROOT}/allSets/`);
  if (!res.ok) return [];
  const data = await res.json();
  const sets = (Array.isArray(data) ? data : []).map((s) => ({ id: s.set_id, name: s.set_name }));
  setCached(cacheKey, sets);
  return sets;
}

export async function getOnePieceCardAutocomplete(query) {
  if (!query || query.length < 3) return [];
  try {
    const cards = await searchOnePieceCards(query);
    return [...new Set(cards.map((c) => c.name))].slice(0, 8);
  } catch {
    return [];
  }
}
