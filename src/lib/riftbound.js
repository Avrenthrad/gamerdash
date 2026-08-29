// Client-side helper for Riftbound card data, proxied through
// api/pricing.js (`?service=riftbound`) — Riftcodex (api.riftcodex.com)
// sends no CORS headers (confirmed live, unlike its TCG-College
// neighbors Yu-Gi-Oh/One Piece, both callable directly — see
// lib/yugioh.js/lib/onepiece.js), so this can't be a direct client fetch.
//
// No real pricing source confirmed — Riftcodex's card object carries a
// tcgplayer_id but no embedded price field, so this stays counts-only,
// same honest situation Flesh and Blood is already in.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

function normalizeRiftboundCard(card) {
  return {
    id: card.id,
    name: card.name,
    riftboundId: card.riftbound_id,
    collectorNumber: card.collector_number,
    energy: card.attributes?.energy ?? null,
    might: card.attributes?.might ?? null,
    power: card.attributes?.power ?? null,
    type: card.classification?.type || null,
    supertype: card.classification?.supertype || null,
    rarity: card.classification?.rarity || null,
    domains: card.classification?.domain || [],
    textPlain: card.text?.plain || "",
    flavour: card.text?.flavour || null,
    setId: card.set?.set_id,
    setName: card.set?.label,
    imageUrl: card.media?.image_url || null,
    artist: card.media?.artist || null,
    tags: card.tags || [],
  };
}

export async function searchRiftboundCards(query) {
  if (!query || !query.trim()) return [];
  const res = await fetch(`${API_BASE}/api/pricing?service=riftbound&mode=search&q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error(`Riftbound search failed for "${query}"`);
  const data = await res.json();
  return (data.items || []).map(normalizeRiftboundCard);
}

export async function getRiftboundCardById(id) {
  const cacheKey = `gd-rb-card-id:${id}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pricing?service=riftbound&mode=card&id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = normalizeRiftboundCard(data);
  setCached(cacheKey, card);
  return card;
}

export async function getRiftboundCardAutocomplete(query) {
  if (!query || query.length < 3) return [];
  try {
    const cards = await searchRiftboundCards(query);
    return [...new Set(cards.map((c) => c.name))].slice(0, 8);
  } catch {
    return [];
  }
}
