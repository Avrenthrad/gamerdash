import { API_BASE } from "./apiBase";
import { getCached, setCached, CACHE_TTL } from "./cache";
// Client-side helper for PlayStation Store prices.
// Talks to our own /api/pricing serverless function (service=platprices)
// instead of platprices.com directly — the API key stays server-side there.

// Bring-your-own-key: each account can optionally set their own free
// PlatPrices key in Account Settings (Preferences), so heavy usage
// draws from THEIR quota instead of everyone sharing one.
let personalKey = null;
export function setPersonalPlatPricesKey(key) {
  personalKey = key || null;
}

function withPersonalKey(url) {
  return personalKey ? `${url}&personalKey=${encodeURIComponent(personalKey)}` : url;
}

// General trophy info about a PS game — counts, difficulty, estimated
// hours to platinum. This is NOT a specific person's earned trophies
// (Sony has no public API for that at all, official or otherwise) —
// it's the same "about this game" category as a Metacritic score.
// Confirmed field names against PlatPrices' real example response
// (Bronze/Silver/Gold/Platinum, Difficulty, HoursLow/HoursHigh,
// TrophyListURL) rather than guessing.
//
// NOTE: their free plan requires "Powered by PlatPrices" attribution
// with a link wherever this data is shown publicly — make sure any
// UI using this includes that credit.
//
// Cached 24h, same as Xbox — this data barely changes day to day, and
// PlatPrices' free tier has a real monthly cap just like XBXprices did.
export async function fetchPSTrophyInfo(gameName) {
  const cacheKey = `gd-pstrophy:${gameName.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  let result;
  try {
    const res = await fetch(withPersonalKey(`${API_BASE}/api/pricing?service=platprices&name=${encodeURIComponent(gameName)}`));
    if (!res.ok) throw new Error(`PlatPrices trophy lookup failed for "${gameName}"`);
    const data = await res.json();

    if (data.error === "no_key") return "no_key"; // don't cache — retry as soon as a key exists
    if (data.error) {
      result = null; // a genuine lookup miss — this title just isn't in their database
    } else {
      const difficulty = Number(data.Difficulty);
      result = {
        bronze: Number(data.Bronze) || 0,
        silver: Number(data.Silver) || 0,
        gold: Number(data.Gold) || 0,
        platinum: Number(data.Platinum) || 0,
        difficulty: difficulty >= 0 ? difficulty : null, // -1 means "unknown" per PlatPrices
        hoursLow: Number(data.HoursLow) >= 0 ? Number(data.HoursLow) : null,
        hoursHigh: Number(data.HoursHigh) >= 0 ? Number(data.HoursHigh) : null,
        trophyListUrl: data.TrophyListURL || null,
      };
    }
  } catch (err) {
    console.error(`PlatPrices trophy lookup threw for "${gameName}":`, err);
    return null;
  }

  setCached(cacheKey, result);
  return result;
}

// Cached 24h, same as Xbox — protects PlatPrices' free-tier quota the
// same way XBXprices needed protecting once real testers were hitting
// it, not just one person locally.
export async function fetchPSPrice(gameName) {
  const cacheKey = `gd-psprice:${gameName.toLowerCase()}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  let result;
  try {
    const res = await fetch(withPersonalKey(`${API_BASE}/api/pricing?service=platprices&name=${encodeURIComponent(gameName)}`));
    if (!res.ok) throw new Error(`PlatPrices lookup failed for "${gameName}"`);
    const data = await res.json();

    // Distinguishing these two matters: "no_key" means we haven't
    // checked yet (should show as "pending" in the UI), while a
    // genuine miss means we checked and this title really isn't on
    // PlayStation (should show as "not sold here"). Collapsing them
    // was a real bug fixed earlier — don't cache "no_key" either, so
    // the very next lookup after a key gets added tries for real
    // instead of waiting out a stale cache entry.
    if (data.error === "no_key") return "no_key";
    if (data.error) {
      result = null;
    } else {
      const basePrice = Number(data.BasePrice) / 100;
      const salePrice = Number(data.SalePrice) / 100;
      result = {
        game: data.GameName || data.ProductName,
        store: "PlayStation Store",
        // Separate price/rrp (not collapsed into one) so a real sale
        // badge can show — matches the Xbox chip's shape. Falls back
        // to basePrice for both when there's no active sale.
        price: salePrice > 0 ? salePrice : basePrice,
        rrp: basePrice > 0 ? basePrice : salePrice,
        lowest: null, // PlatPrices' free plan doesn't include price history
        lowestDate: "—",
      };
    }
  } catch (err) {
    console.error(`PlayStation price lookup threw for "${gameName}":`, err);
    return null;
  }

  setCached(cacheKey, result);
  return result;
}
