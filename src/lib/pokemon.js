// Client-side helper for pokemontcg.io's real Pokémon TCG API.
// See api/pokemon.js for the proxy and reliability notes.
//
// No documented attribution requirement found for pokemontcg.io, but a
// small credit line is still shown in the UI, matching this app's
// habit of crediting every real data source it uses.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

// pokemontcg.io's `q` param is a real Lucene-style query — confirmed
// live that an unquoted multi-word name term (`name:tapu koko`) is
// rejected outright (400), while the documented quoted-phrase form
// (`name:"venusaur v"`) is the real, working syntax. Every real search
// this app does by name goes through this helper so that's never
// re-broken by a caller building the query string by hand.
export function nameQuery(name) {
  return `name:"${name.replace(/"/g, '\\"')}"`;
}

// card.id (e.g. "sv1-8") already identifies one specific real printing
// directly — unlike Flesh and Blood's card-vs-printing split, this is
// closer to Scryfall's shape.
function normalizePokemonCard(card) {
  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    hp: card.hp,
    types: card.types || [],
    attacks: card.attacks || [],
    abilities: card.abilities || [],
    weaknesses: card.weaknesses || [],
    resistances: card.resistances || [],
    retreatCost: card.retreatCost || [],
    setId: card.set?.id,
    setName: card.set?.name,
    number: card.number,
    rarity: card.rarity,
    imageSmall: card.images?.small || null,
    imageLarge: card.images?.large || null,
    legalities: card.legalities || {}, // { standard, expanded, unlimited } — "Legal" capitalized, confirmed live
    // Real finish/edition variants actually sold for THIS printing —
    // whatever keys tcgplayer.prices really has, not a fabricated list.
    finishes: Object.keys(card.tcgplayer?.prices || {}),
    tcgplayerPrices: card.tcgplayer?.prices || null,
    tcgplayerUpdatedAt: card.tcgplayer?.updatedAt || null,
    cardmarketPrices: card.cardmarket?.prices || null,
    cardmarketUpdatedAt: card.cardmarket?.updatedAt || null,
  };
}

function normalizePokemonSet(set) {
  return {
    id: set.id,
    name: set.name,
    series: set.series,
    printedTotal: set.printedTotal,
    total: set.total,
    releasedAt: set.releaseDate,
    logoUrl: set.images?.logo || null,
    symbolUrl: set.images?.symbol || null,
  };
}

// A real Cardmarket or TCGplayer market price for one card, preferring
// TCGplayer's "market" figure (closest to an actual real-time price)
// and falling back to Cardmarket's trend price — both real, both
// labeled with their own source, never blended into one ambiguous number.
export function currentPokemonPrice(card) {
  const tcg = card.tcgplayerPrices;
  if (tcg) {
    const variant = tcg.market != null ? tcg : Object.values(tcg)[0];
    if (variant?.market != null) return { price: variant.market, source: "tcgplayer", asOf: card.tcgplayerUpdatedAt };
  }
  const cm = card.cardmarketPrices;
  if (cm?.trendPrice != null) return { price: cm.trendPrice, source: "cardmarket", asOf: card.cardmarketUpdatedAt };
  return null;
}

export async function searchPokemonCards(query, page = 1, orderBy, pageSize = 30) {
  const params = new URLSearchParams({ mode: "search", q: query, page: String(page), pageSize: String(pageSize) });
  if (orderBy) params.set("orderBy", orderBy);
  const res = await fetch(`${API_BASE}/api/pokemon?${params.toString()}`);
  if (!res.ok) throw new Error(`Pokémon TCG search failed for "${query}"`);
  const data = await res.json();
  return {
    cards: (data.data || []).map(normalizePokemonCard),
    totalCount: data.totalCount || 0,
    page: data.page || 1,
    pageSize: data.pageSize || 30,
  };
}

// Confirmed live: short/broad queries are specifically the unreliable
// case for this API (a 2-char prefix failed with 502 on repeated
// retries, while full names succeeded every time) — the opposite of
// what MTG/FaB's autocomplete needs. Only fires at 4+ characters, and
// a failure here just yields no suggestions rather than surfacing an
// error — the real Search button stays reliable regardless.
export async function getPokemonCardAutocomplete(query) {
  if (!query || query.length < 4) return [];
  try {
    const { cards } = await searchPokemonCards(`name:${query}*`, 1);
    return [...new Set(cards.map((c) => c.name))].slice(0, 8);
  } catch {
    return [];
  }
}

export async function getPokemonCardById(id) {
  const cacheKey = `gd-poke-card-id:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pokemon?mode=card&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = normalizePokemonCard(data.data);
  setCached(cacheKey, card);
  return card;
}

export async function getPokemonSet(id) {
  const cacheKey = `gd-poke-set:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pokemon?mode=set&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const set = normalizePokemonSet(data.data);
  setCached(cacheKey, set);
  return set;
}

export async function getAllPokemonSets() {
  const cacheKey = "gd-poke-all-sets";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pokemon?mode=sets`);
  if (!res.ok) return [];
  const data = await res.json();
  const sets = (data.data || [])
    .map(normalizePokemonSet)
    .sort((a, b) => (b.releasedAt || "").localeCompare(a.releasedAt || ""));
  setCached(cacheKey, sets);
  return sets;
}

// Every real card in a set, for the set-list checklist — confirmed
// live that `set.id:<code>` genuinely scopes correctly (returned
// exactly a set's own real `total` card count), unlike Flesh and
// Blood's equivalent filter which didn't. Paginates through
// pokemontcg.io's real page/pageSize rather than assuming one page.
export async function getPokemonSetCards(id) {
  const cacheKey = `gd-poke-set-cards:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  let all = [];
  let page = 1;
  while (page <= 10) {
    const { cards, totalCount } = await searchPokemonCards(`set.id:${id}`, page, null, 250);
    all = all.concat(cards);
    if (all.length >= totalCount || cards.length === 0) break;
    page += 1;
  }
  all.sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
  setCached(cacheKey, all);
  return all;
}

// Real set logo (from the set's own metadata), for a freshly created
// set-list binder's default cover — never a placeholder.
export async function getPokemonSetCoverArt(id) {
  const set = await getPokemonSet(id);
  return set?.logoUrl || null;
}
