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
    collectorNumber: card.collector_number,
    image: card.image_uris?.normal || face?.image_uris?.normal || null,
    imageSmall: card.image_uris?.small || face?.image_uris?.small || null,
    imageLarge: card.image_uris?.large || face?.image_uris?.large || null,
    artCrop: card.image_uris?.art_crop || face?.image_uris?.art_crop || null,
    prices: card.prices || {},
    legalities: card.legalities || {},
    scryfallUri: card.scryfall_uri,
  };
}

// Real Set metadata (name, card_count, icon_svg_uri, released_at) —
// used when creating a "set list" binder. Field names verified live
// against api.scryfall.com/sets/<code>, not guessed.
function normalizeSet(set) {
  return {
    id: set.id,
    code: set.code,
    name: set.name,
    setType: set.set_type,
    cardCount: set.card_count,
    releasedAt: set.released_at,
    iconSvgUri: set.icon_svg_uri,
    scryfallUri: set.scryfall_uri,
  };
}

export async function searchCards(query, page = 1, unique = "cards") {
  const res = await fetch(
    `${API_BASE}/api/scryfall?mode=search&q=${encodeURIComponent(query)}&page=${page}&unique=${unique}`
  );
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
export async function getCardByName(exactName, setCode) {
  const cacheKey = `gd-mtg-card:${exactName.toLowerCase()}${setCode ? `:${setCode.toLowerCase()}` : ""}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const url = `${API_BASE}/api/scryfall?mode=named&exact=${encodeURIComponent(exactName)}${setCode ? `&set=${encodeURIComponent(setCode)}` : ""}`;
  const res = await fetch(url);
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

// Cached 1 day — a set's own metadata (name, card count, icon) is
// effectively static once printed.
export async function getSet(code) {
  const cacheKey = `gd-mtg-set:${code.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/scryfall?mode=set&code=${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const set = normalizeSet(data);
  setCached(cacheKey, set);
  return set;
}

// Every real Scryfall set — powers the "search a set" picker when
// starting a new set list. One request, cached a full day client-side
// (new sets release every few weeks at most, not worth refetching
// per session).
export async function getAllSets() {
  const cacheKey = "gd-mtg-all-sets";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/scryfall?mode=sets`);
  if (!res.ok) return [];
  const data = await res.json();
  const sets = (data.data || [])
    .map(normalizeSet)
    .sort((a, b) => (b.releasedAt || "").localeCompare(a.releasedAt || ""));
  setCached(cacheKey, sets);
  return sets;
}

// Every real printing in a set, for the set list checklist — reuses
// the same search endpoint as normal card search, scoped with
// Scryfall's own `e:<code>` set-code syntax and ordered by collector
// number so the checklist reads in booster/set order. Paginates
// through Scryfall's real has_more/next results rather than assuming
// one page covers the whole set (large sets exceed the 175-per-page
// cap Scryfall documents for /cards/search).
export async function getSetCards(code) {
  const cacheKey = `gd-mtg-set-cards:${code.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 10) {
    const { cards, hasMore: more } = await searchCards(`e:${code}`, page, "prints");
    all = all.concat(cards);
    hasMore = more;
    page += 1;
  }
  all.sort((a, b) =>
    (Number(a.collectorNumber) || 0) - (Number(b.collectorNumber) || 0)
  );
  setCached(cacheKey, all);
  return all;
}

// Default cover art for a new set-list binder — a real card's art
// crop from that real set (Scryfall's own image), not a placeholder.
// Users can still upload their own cover afterward; this just means a
// freshly created set list never starts blank.
export async function getSetCoverArt(code) {
  const cacheKey = `gd-mtg-set-cover:${code.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const { cards } = await searchCards(`e:${code}`, 1);
  const url = cards.find((c) => c.artCrop)?.artCrop || null;
  setCached(cacheKey, url);
  return url;
}
