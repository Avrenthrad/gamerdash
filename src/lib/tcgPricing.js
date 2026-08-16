// Real MTG pricing beyond Scryfall's own baseline: Card Kingdom's
// public retail pricelist (see api/pricing.js), plus a shared price
// history table this app builds up over time from real observations
// (never backfilled or fabricated — history starts from whenever this
// feature first records a price, and says so honestly).
//
// Normalized shape used everywhere prices are shown:
//   { game: 'mtg', productType: 'single', market, low, foil, currency, source, asOf }

import { API_BASE } from "./apiBase";
import { supabase } from "./supabaseClient";
import { getCached, setCached, CACHE_TTL } from "./cache";

export async function fetchCardKingdomPrices(scryfallIds) {
  if (!scryfallIds || scryfallIds.length === 0) return {};
  const cacheKey = `gd-ck-prices:${[...scryfallIds].sort().join(",")}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/pricing?service=cardkingdom&scryfallIds=${scryfallIds.join(",")}`);
  if (!res.ok) return {};
  const data = await res.json();
  setCached(cacheKey, data);
  return data; // { asOf, results: { [scryfallId]: [{ name, variation, edition, isFoil, priceRetail, qtyRetail, url }] } }
}

// Combines a card's already-known Scryfall price with Card Kingdom's
// real retail price into the shared normalized shape — always both,
// when both are real and available, each clearly labeled with its
// own source rather than collapsed into one ambiguous number.
export function normalizeMtgPrices(card, ckEntries, ckAsOf) {
  const prices = [];

  if (card.prices?.usd) {
    prices.push({
      game: "mtg", productType: "single", market: "Scryfall (market)",
      low: Number(card.prices.usd), foil: false, currency: "USD", source: "scryfall", asOf: null,
    });
  }
  if (card.prices?.usd_foil) {
    prices.push({
      game: "mtg", productType: "single", market: "Scryfall (market)",
      low: Number(card.prices.usd_foil), foil: true, currency: "USD", source: "scryfall", asOf: null,
    });
  }

  for (const entry of ckEntries || []) {
    if (entry.priceRetail == null) continue;
    prices.push({
      game: "mtg", productType: "single", market: "Card Kingdom",
      low: entry.priceRetail, foil: entry.isFoil, currency: "USD", source: "cardkingdom", asOf: ckAsOf,
      url: entry.url,
    });
  }

  return prices;
}

// ---------- Price history (shared, real, grows from real observations) ----------

export async function recordPriceSnapshot({ scryfallId, source, market, price, foil, currency = "USD" }) {
  if (!scryfallId || price == null) return;
  const { error } = await supabase
    .from("tcg_price_snapshots")
    .insert({ scryfall_id: scryfallId, source, market, price, foil, currency });
  if (error) console.error("Failed to record price snapshot:", error);
}

export async function fetchPriceHistory(scryfallId, days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tcg_price_snapshots")
    .select("*")
    .eq("scryfall_id", scryfallId)
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
