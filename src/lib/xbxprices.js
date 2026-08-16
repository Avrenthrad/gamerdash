// Client-side helper for XBXprices (real Xbox/Microsoft Store pricing).
// Talks to our own /api/pricing serverless function (service=xbxprices) — same pattern
// as every other real API in this project, key stays server-side.
//
// Prices come back from XBXprices already in the requested region's
// real currency (region=au gives real AUD), same deal as Steam's own
// price API — no FX conversion needed, unlike the CheapShark-sourced
// stores (GOG/Epic/Humble).

import { getCached, setCached, CACHE_TTL } from "./cache";
import { API_BASE } from "./apiBase";

// Bring-your-own-key: each account can optionally set their own free
// XBXprices key in Account Settings (Preferences), so heavy usage
// draws from THEIR 1,000/month quota instead of everyone sharing one.
// Set once from App.jsx whenever the account's saved key changes —
// avoids threading a key parameter through every call site in this
// file and everywhere it's used.
let personalKey = null;
export function setPersonalXbxPricesKey(key) {
  personalKey = key || null;
}

function withPersonalKey(url) {
  return personalKey ? `${url}&personalKey=${encodeURIComponent(personalKey)}` : url;
}

async function searchXboxGame(title, region) {
  const res = await fetch(withPersonalKey(`${API_BASE}/api/pricing?service=xbxprices&endpoint=search&q=${encodeURIComponent(title)}&region=${region}`));
  let data;
  try {
    data = await res.json();
  } catch {
    return null; // malformed/non-JSON response — treat as "no match" rather than throwing
  }
  if (data.error === "no_key") return "no_key";
  if (!res.ok || data.error || !data.success) return null;
  return data.data?.[0] || null; // first/best match
}

async function fetchXboxGameDetails(ppid, region) {
  const res = await fetch(withPersonalKey(`${API_BASE}/api/pricing?service=xbxprices&endpoint=game&ppid=${ppid}&region=${region}`));
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error || !data.success) return null;
  return data.data;
}

// Give it a game title, get back:
//   - { price, rrp, discPerc } if XBXprices has it
//   - null if the search genuinely found nothing (title not on Xbox,
//     or not in XBXprices' data) — this is a real "not sold here"
//   - "no_key" if XBXPRICES_KEY isn't configured yet — this is
//     "pending integration", a different thing entirely, so the UI
//     can tell the two apart instead of showing a false "not sold here"
//
// Cached 24h in localStorage — this is the piece that actually keeps
// a 1,000-request/month free plan viable. Without it, a 100-game
// wishlist costs ~200 requests (search + details per game) on *every*
// page load, not just once — that's 5 reloads and the month's quota
// is gone. With the cache, that 100-game list only costs quota once
// a day, however many times the page is opened in between.
export async function fetchXboxPrice(title, region = "au") {
  // Cache key bumped to v2 — v1 entries may have the Game Pass
  // false-positive bug (see comment above fetchXboxPriceUncached),
  // this ensures those get refetched instead of waiting out the 24h TTL.
  const cacheKey = `gd-xbx3:${title.toLowerCase()}:${region}`;
  const cached = getCached(cacheKey, CACHE_TTL.ONE_DAY);
  if (cached !== undefined) return cached;

  let result;
  try {
    result = await fetchXboxPriceUncached(title, region);
  } catch (err) {
    // Previously this would propagate up and get silently swallowed
    // by the caller's .catch(() => {}) — leaving the card stuck
    // showing "Pending integration" forever, which looks exactly like
    // Xbox was never wired up, even for titles genuinely on Xbox.
    // Logging here at least makes a real failure visible instead of
    // indistinguishable from "not implemented yet".
    console.error(`Xbox price lookup threw for "${title}":`, err);
    return null;
  }

  // Don't cache "no_key" — once a key gets added, we want the very
  // next lookup to actually try it, not wait out a stale cache entry.
  if (result !== "no_key") {
    setCached(cacheKey, result);
  }
  return result;
}

async function fetchXboxPriceUncached(title, region) {
  let match = await searchXboxGame(title, region);

  // Fallback: some storefronts catalogue titles without the full
  // subtitle ("DOOM" vs "DOOM: The Dark Ages") or with different
  // punctuation — if the exact title search comes up empty, retry
  // with just the part before a colon/dash rather than giving up
  // and showing a title that's genuinely on Xbox as "pending".
  if (!match) {
    const simplified = title.split(/[:\-–]/)[0].trim();
    if (simplified && simplified.toLowerCase() !== title.toLowerCase()) {
      match = await searchXboxGame(simplified, region);
    }
  }

  if (match === "no_key") return "no_key";
  if (!match) return null;

  const ppid = match.PPID ?? match.ppid;
  if (!ppid) return null;

  const details = await fetchXboxGameDetails(ppid, region);
  if (!details) return null;

  return {
    price: details.SalePrice / 100,
    rrp: details.BasePrice / 100,
    discPerc: details.DiscPerc || 0,
    xboxProductId: details.XboxProductID || null,
    // Console availability — confirmed real fields from XBXprices.
    // NOTE: I couldn't confirm whether they expose a separate "on PC
    // via Microsoft Store" flag beyond these two console ones (their
    // full field reference needs a dashboard login I don't have) —
    // but in practice, titles like Baldur's Gate 3 and Elden Ring
    // were never released on Windows through the Microsoft Store at
    // all (their PC versions are Steam-only), so these console flags
    // alone should already explain "console but not PC" correctly.
    isXboxSeriesXS: Boolean(details.IsXboxSeriesXS),
    isXboxOne: Boolean(details.IsXboxOne),
    // Game Pass — a genuinely positive price means it's currently in
    // the catalogue. NOTE: fixed a real bug here — XBXprices appears
    // to return 0 (not null) for GamePassPrice on titles that aren't
    // on Game Pass at all, and `!= null` doesn't catch a 0, which is
    // exactly why Elden Ring (not on Game Pass) was showing the badge.
    onGamePass: details.GamePassPrice != null && details.GamePassPrice > 0,
    gamePassPrice: details.GamePassPrice > 0 ? details.GamePassPrice / 100 : null,
  };
}
