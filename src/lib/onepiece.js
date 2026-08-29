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

function normalizeOnePieceCard(card) {
  return {
    id: card.card_set_id,
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

export async function getOnePieceCardById(cardSetId) {
  const cacheKey = `gd-optcg-card-id:${cardSetId}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_ROOT}/sets/card/${encodeURIComponent(cardSetId)}/`);
  if (!res.ok) return null;
  const data = await res.json();
  // Real printings share one card_set_id but can have multiple rows
  // (e.g. a Parallel variant) — the first (non-parallel) is the card's
  // own canonical printing.
  const card = Array.isArray(data) && data.length > 0 ? normalizeOnePieceCard(data[0]) : null;
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
