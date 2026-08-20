// Client-side helper for goagain.dev's real Flesh and Blood card API.
// See api/fab.js for the proxy and field-verification notes.
//
// This is a deliberately DIFFERENT shape from lib/scryfall.js's
// normalizeCard, not a reuse of it — Flesh and Blood's real card
// object has different real fields (pitch, cost, power/defense/health,
// per-format legal/banned/suspended flags instead of one legalities
// map, no foil/finish on the card at all — that lives per-printing).
// Forcing MTG's shape onto this data would misrepresent it.
//
// No documented attribution requirement was found for goagain.dev —
// a small credit line is still shown in the UI regardless, matching
// this app's habit of crediting every real data source it uses.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

function normalizeFabPrinting(p) {
  return {
    // p.unique_id is the PRINTING's own id, confirmed live to be
    // distinct from the card's unique_id — this is the real "which
    // exact printing is owned" identifier.
    printingId: p.unique_id,
    printCode: p.id, // human-readable, e.g. "1HP002"
    setId: p.set_id,
    edition: p.edition,
    // Real per-printing finish code confirmed live: "S"/"R"/"C" seen
    // ("Standard"/"Rainbow Foil"/"Cold Foil" per matching tcgplayer_url
    // printing labels) — real data, not self-reported.
    foiling: p.foiling,
    rarity: p.rarity,
    imageUrl: p.image_url || null,
    artists: p.artists || [],
    flavorText: p.flavor_text || "",
  };
}

function normalizeFabCard(card) {
  return {
    id: card.unique_id,
    name: card.name,
    pitchColor: card.color, // "", "Red", "Yellow", "Blue"
    pitch: card.pitch, // "1"/"2"/"3"/""
    cost: card.cost,
    power: card.power,
    defense: card.defense,
    health: card.health,
    intelligence: card.intelligence,
    arcane: card.arcane,
    types: card.types || [], // class/card type/subtypes combined, e.g. ["Brute", "Hero", "Young"]
    traits: card.traits || [],
    keywords: card.card_keywords || [],
    text: card.functional_text || "",
    textPlain: card.functional_text_plain || "",
    typeText: card.type_text || "",
    playedHorizontally: !!card.played_horizontally,
    isHero: (card.types || []).includes("Hero"),
    // Per-format flags, confirmed live via raw curl to include a 6th
    // format (upf) with no legal field at all (banned-list format,
    // not a legal-list one), and commoner_suspended/ll_restricted
    // which the project's earlier assumption missed.
    formats: {
      blitz: { legal: card.blitz_legal, banned: card.blitz_banned, suspended: card.blitz_suspended, livingLegend: card.blitz_living_legend, livingLegendStart: card.blitz_living_legend_start },
      cc: { legal: card.cc_legal, banned: card.cc_banned, suspended: card.cc_suspended, livingLegend: card.cc_living_legend },
      commoner: { legal: card.commoner_legal, banned: card.commoner_banned, suspended: card.commoner_suspended },
      ll: { legal: card.ll_legal, banned: card.ll_banned, restricted: card.ll_restricted },
      silver_age: { legal: card.silver_age_legal, banned: card.silver_age_banned },
      upf: { banned: card.upf_banned }, // no upf_legal field exists
    },
    printings: (card.printings || []).map(normalizeFabPrinting),
  };
}

function normalizeFabSetPrinting(p) {
  return {
    printingId: p.unique_id,
    edition: p.edition,
    startCardId: p.start_card_id,
    endCardId: p.end_card_id,
    releasedAt: p.initial_release_date,
    outOfPrint: !!p.out_of_print,
    // Confirmed live — a real set logo image per printing/edition of
    // the set itself.
    logoUrl: p.set_logo || null,
  };
}

function normalizeFabSet(set) {
  return {
    id: set.unique_id,
    code: set.id, // short code, e.g. "1HP"
    name: set.name,
    printings: (set.printings || []).map(normalizeFabSetPrinting),
  };
}

// The five real per-format illegal/banned/suspended checks this app
// actually needs, given goagain's real (non-uniform) flag shape — see
// lib/fabCollection.js's checkFabDeckLegality for how this is used per
// deck card.
export function isFabCardIllegal(card, format) {
  const f = card.formats?.[format];
  if (!f) return true;
  if (format === "upf") return !!f.banned; // banned-list format, no legal flag
  return !f.legal || !!f.banned;
}

export async function searchFabCards(filters = {}, offset = 0, limit = 30) {
  const params = new URLSearchParams({ mode: "search", offset: String(offset), limit: String(limit) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const res = await fetch(`${API_BASE}/api/fab?${params.toString()}`);
  if (!res.ok) throw new Error("Flesh and Blood search failed");
  const data = await res.json();
  return {
    cards: (data.data || []).map(normalizeFabCard),
    total: data.total || 0,
    hasMore: (data.offset || 0) + (data.data || []).length < (data.total || 0),
  };
}

// goagain has no separate autocomplete endpoint — confirmed live that
// its real name search does clean prefix/substring matching, so this
// just doubles as autocomplete off a small page size.
export async function getFabCardAutocomplete(query) {
  if (!query || query.length < 2) return [];
  const { cards } = await searchFabCards({ name: query }, 0, 8);
  return cards.map((c) => c.name);
}

export async function getFabCardById(id) {
  const cacheKey = `gd-fab-card-id:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/fab?mode=card&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = normalizeFabCard(data);
  setCached(cacheKey, card);
  return card;
}

// Separate from the card object's own format flags — confirmed live
// this endpoint is the more authoritative source for upf specifically
// (upf_legal doesn't exist on the card object at all, but this
// endpoint returns it). Not cached as long as card data (legality can
// change with a new banned/suspended list announcement).
export async function getFabCardLegality(id) {
  const res = await fetch(`${API_BASE}/api/fab?mode=legality&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.legalities || []; // [{ format, legal, living_legend? }, ...]
}

export async function getFabSet(id) {
  const cacheKey = `gd-fab-set:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/fab?mode=set&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const set = normalizeFabSet(data);
  setCached(cacheKey, set);
  return set;
}

export async function getAllFabSets() {
  const cacheKey = "gd-fab-all-sets";
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/fab?mode=sets`);
  if (!res.ok) return [];
  const data = await res.json();
  const sets = (Array.isArray(data) ? data : data.data || []).map(normalizeFabSet);
  setCached(cacheKey, sets);
  return sets;
}

// Real set logo (from the set's newest printing/edition), for a
// freshly created set-list binder's default cover — same "never a
// placeholder, real image or nothing" rule getSetCoverArt already
// follows for MTG.
export async function getFabSetCoverArt(setId) {
  const set = await getFabSet(setId);
  if (!set) return null;
  const withLogo = [...set.printings].reverse().find((p) => p.logoUrl);
  return withLogo?.logoUrl || null;
}
