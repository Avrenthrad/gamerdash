// Client-side helper for Rebrickable's real LEGO set database.
// See api/pricing.js's handleRebrickable for the proxy (folded into
// the shared pricing function to stay under Vercel's Hobby-plan
// 12-function limit, not because Rebrickable is pricing-related).
//
// Rebrickable genuinely requires a free API key (confirmed live — an
// unauthenticated request returns a real 401), same "no_key" honest
// degradation pattern already used for RAWG/XBXprices/PlatPrices —
// this returns "no_key" until REBRICKABLE_KEY is set on the server,
// rather than pretending the feature works.

import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";

function normalizeSet(set) {
  return {
    setNum: set.set_num,
    name: set.name,
    year: set.year,
    numParts: set.num_parts,
    imageUrl: set.set_img_url || null,
  };
}

export async function searchRebrickableSets(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await fetch(`${API_BASE}/api/pricing?service=rebrickable&mode=search&q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) throw new Error("Rebrickable search failed");
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return (data.results || []).map(normalizeSet);
}

// Cached 1 day — a real LEGO set's own metadata doesn't change once
// released.
export async function getRebrickableSet(setNum) {
  const cacheKey = `gd-rebrickable-set:${setNum}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pricing?service=rebrickable&mode=set&setNum=${encodeURIComponent(setNum)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  const set = normalizeSet(data);
  setCached(cacheKey, set);
  return set;
}
