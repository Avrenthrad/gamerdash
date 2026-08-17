// Client-side helper for generic UPC/EAN barcode product lookup — see
// api/upc.js. Used by Collectibles to identify a scanned Pop Vinyl/
// Lego box/other product. Cached a week since product metadata for a
// given barcode essentially never changes.

import { getCached, setCached, CACHE_TTL } from "./cache";
import { API_BASE } from "./apiBase";

export async function lookupProductByBarcode(barcode) {
  const cacheKey = `gd-upc:${barcode}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_WEEK);
  if (cached !== undefined) return cached;

  const res = await fetch(`${API_BASE}/api/upc?barcode=${encodeURIComponent(barcode)}`);
  if (!res.ok) throw new Error("UPC lookup failed");
  const data = await res.json();
  const item = data.items?.[0] || null;
  const result = item
    ? {
        barcode,
        title: item.title || "",
        brand: item.brand || "",
        imageUrl: item.images?.[0] || null,
      }
    : null;

  setCached(cacheKey, result);
  return result;
}
