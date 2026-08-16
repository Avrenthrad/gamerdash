// Client-side helper for the Fortnite Item Shop.
// Talks to our own /api/fortnite serverless function — genuinely
// free, no-key public API (fortnite-api.com), unlike most of the
// "extra" integrations in this project.
//
// FIXED A REAL BUG: the field for the most common item type (skins,
// emotes, pickaxes etc.) is `entry.br`, not `entry.brItems` — that
// wrong field name doesn't exist on their response at all, so nearly
// every entry was silently falling through to a broken fallback and
// rendering blank. Confirmed the real field names against their
// actual class reference docs (fortnite-api.readthedocs.io) this
// time instead of guessing from memory.
//
// Cached only a few hours (not the usual 24h) since the shop rotates
// daily at 00:00 UTC — a full day's cache could show yesterday's shop.

import { getCached, setCached } from "./cache";
import { API_BASE } from "./apiBase";

const SHOP_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

// Their Asset fields are plain URL strings in the raw JSON (the
// nested {url, ...} object is something their official Python
// wrapper constructs client-side, not what the raw API returns) —
// but handled defensively either way in case that assumption is wrong.
function assetUrl(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.url || null;
}

// Every cosmetic-type list on a ShopEntry (br, cars, tracks,
// instruments, legoKits) shares the same shape for the fields we need.
function normalizeCosmeticItem(item, entry) {
  return {
    name: item.name,
    // A real chunk of cosmetics don't have icon/smallIcon populated
    // (confirmed from a real screenshot — many shop items rendering
    // blank despite having a valid name/rarity). Their images object
    // also has large/featured/wide fields that aren't always empty
    // when icon/smallIcon are — trying those too meaningfully
    // improves the real hit rate instead of leaving more blank boxes
    // than necessary.
    image: assetUrl(item.images?.icon)
      || assetUrl(item.images?.smallIcon)
      || assetUrl(item.images?.large)
      || assetUrl(item.images?.featured),
    rarity: item.rarity?.displayValue || null,
    price: entry.finalPrice,
    regularPrice: entry.regularPrice,
  };
}

export async function fetchFortniteShop() {
  const cacheKey = "gd-fortnite-shop5"; // bumped after adding more image field fallbacks
  const cached = getCached(cacheKey, SHOP_CACHE_TTL);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/fortnite`);
  if (!res.ok) throw new Error("Failed to load the Fortnite shop");
  const data = await res.json();

  const entries = data.data?.entries || [];
  const items = entries.flatMap((entry) => {
    const cosmeticList = entry.br || entry.cars || entry.tracks || entry.instruments || entry.legoKits || [];

    if (cosmeticList.length > 0) {
      return cosmeticList.map((item) => normalizeCosmeticItem(item, entry));
    }

    // Bundles have their own clean name/image — show those. Anything
    // else with no cosmetic list and no bundle (V-Bucks currency
    // packs, and similar non-cosmetic entries) gets skipped entirely
    // rather than showing an ugly raw internal devName string like
    // "[VIRTUAL]1 x Golden Spatula for 500 MtxCurrency" — that was a
    // real bug, not really an "item" worth showing in a shop preview.
    if (entry.bundle?.name) {
      return [{
        name: entry.bundle.name,
        image: assetUrl(entry.bundle.image)
          || assetUrl(entry.newDisplayAsset?.renderImages?.[0]?.image)
          || assetUrl(entry.newDisplayAsset?.materialInstances?.[0]?.images?.offerImage)
          || null,
        rarity: null,
        price: entry.finalPrice,
        regularPrice: entry.regularPrice,
      }];
    }
    return [];
  })
    // A handful of individual cosmetic entries in Fortnite's own data
    // genuinely have no name (and no rarity) at all — confirmed from
    // a real screenshot showing blank cards with just a price. Rather
    // than render something broken-looking, skip anything that ended
    // up nameless instead of guessing at a placeholder.
    .filter((item) => item.name);

  setCached(cacheKey, items);
  return items;
}
