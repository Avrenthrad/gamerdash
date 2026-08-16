// Client-side helper for Scryfall's real Magic: The Gathering API.
// See api/scryfall.js for the proxy and field-verification notes.
//
// Scryfall's free-tier attribution requirement is handled by the
// pages that render this data (a visible "Powered by Scryfall" link),
// not here — don't strip that out if you're editing those pages.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

// Double-faced cards (transform, modal DFC, split) don't have a
// top-level image_uris/mana_cost/etc. — those live per-face instead,
// in card_faces[0]/[1]. Falling back to the front face keeps every
// card renderable with one consistent shape, rather than having to
// special-case DFCs everywhere this data gets used.
function normalizeCard(card) {
  const face = card.card_faces?.[0];
  return {
    id: card.id,
    name: card.name,
    manaCost: card.mana_cost || face?.mana_cost || "",
    typeLine: card.type_line || face?.type_line || "",
    oracleText: card.oracle_text || face?.oracle_text || "",
    power: card.power ?? face?.power ?? null,
    toughness: card.toughness ?? face?.toughness ?? null,
    colors: card.colors || face?.colors || [],
    rarity: card.rarity,
    setName: card.set_name,
    setCode: card.set,
    image: card.image_uris?.normal || face?.image_uris?.normal || null,
    imageSmall: card.image_uris?.small || face?.image_uris?.small || null,
    prices: card.prices || {},
    legalities: card.legalities || {},
    scryfallUri: card.scryfall_uri,
  };
}

export async function searchCards(query, page = 1) {
  const res = await fetch(`${API_BASE}/api/scryfall?mode=search&q=${encodeURIComponent(query)}&page=${page}`);
  if (!res.ok) throw new Error(`Scryfall search failed for "${query}"`);
  const data = await res.json();
  return {
    cards: (data.data || []).map(normalizeCard),
    totalCards: data.total_cards || 0,
    hasMore: data.has_more || false,
  };
}

export async function getCardAutocomplete(query) {
  if (!query || query.length < 2) return [];
  const res = await fetch(`${API_BASE}/api/scryfall?mode=autocomplete&q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || []; // array of plain name strings
}

// Cached 24h — a specific printing's core data (text, legalities)
// doesn't change day to day. Prices technically fluctuate daily but
// this matches the same caching discipline used for every other
// pricing source in this project (Xbox, PlayStation) to protect
// against hammering a free API unnecessarily.
export async function getCardByName(exactName) {
  const cacheKey = `gd-mtg-card:${exactName.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/scryfall?mode=named&exact=${encodeURIComponent(exactName)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = normalizeCard(data);
  setCached(cacheKey, card);
  return card;
}

export async function getCardById(id) {
  const cacheKey = `gd-mtg-card-id:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/scryfall?mode=card&id=${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = normalizeCard(data);
  setCached(cacheKey, card);
  return card;
}
