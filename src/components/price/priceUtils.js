/**
 * Pure helpers + constants for the Store Tracker / price comparison UI.
 * Extracted from the original monolithic PriceComparisonPage.
 */

// The only 3 stores that still genuinely need CheapShark — no public
// price API of their own exists for any of these.
export const CURATED_STORES = ["GOG", "Epic Games Store", "Humble Store"];

// The person's 7 trusted digital sellers, in default priority order.
// Account Settings > Platform Preferences can reorder these.
export const PRIORITY_STORE_NAMES = [
  "Steam",
  "Xbox Store",
  "PlayStation Store",
  "GOG",
  "Epic Games Store",
  "Humble Store",
  "G2A",
];

// Real favicon per store via Google's public favicon proxy.
const STORE_DOMAINS = {
  Steam: "store.steampowered.com",
  "Xbox Store": "xbox.com",
  "PlayStation Store": "playstation.com",
  GOG: "gog.com",
  "Epic Games Store": "epicgames.com",
  "Humble Store": "humblebundle.com",
  G2A: "g2a.com",
  "EB Games AU": "ebgames.com.au",
  "JB Hi-Fi": "jbhifi.com.au",
  Fanatical: "fanatical.com",
  GreenManGaming: "greenmangaming.com",
  GameBillet: "gamebillet.com",
  Gamesplanet: "gamesplanet.com",
  WinGameStore: "wingamestore.com",
  GamersGate: "gamersgate.com",
  IndieGala: "indiegala.com",
  Gamesload: "gamesload.com",
};

export function faviconFor(storeName) {
  const domain = STORE_DOMAINS[storeName];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;
}

/** Drop trailing " Store" ("Xbox Store" → "Xbox"). */
export function shortStoreName(name) {
  return name.replace(/ Store$/, "");
}

/** Smooth red→green grade from Steam's %-positive reviews. */
export function steamReviewStyle(meta) {
  if (!meta?.totalReviews) return {};
  const percent = (meta.totalPositive / meta.totalReviews) * 100;
  const hue = Math.round((percent / 100) * 120); // 0 = red, 120 = green
  return {
    color: `hsl(${hue}, 70%, 60%)`,
    borderColor: `hsl(${hue}, 55%, 35%)`,
  };
}

export function relativeTime(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

export function linkForStore(name, storeEntry, steamAppID) {
  if (name === "Steam" && steamAppID) {
    return `https://store.steampowered.com/app/${steamAppID}`;
  }
  if (storeEntry?.dealID) {
    return `https://www.cheapshark.com/redirect?dealID=${storeEntry.dealID}`;
  }
  return null;
}

export function hltbLinkFor(gameTitle) {
  return `https://howlongtobeat.com/?q=${encodeURIComponent(gameTitle)}`;
}

/**
 * Build the primary / physical / secondary store chip rows for a deal.
 * Prefer Steam's real AU regional price over CheapShark's USD×FX.
 */
export function buildStoreRow(deal, meta, platformOrder = PRIORITY_STORE_NAMES) {
  const byName = {};
  deal.stores.forEach((s) => {
    byName[s.store] = s;
  });

  const steamEntry = byName["Steam"];
  const steamPrice = meta?.steamAuPrice ?? steamEntry?.price;
  const steamRrp = meta?.steamAuRrp ?? steamEntry?.rrp;
  const steamIsRealAud = meta?.steamAuPrice != null;

  const xboxPrice = meta?.xboxAuPrice;
  const xboxState = !meta?.xboxChecked ? "pending" : xboxPrice != null ? "price" : "unsold";
  const xboxLink = meta?.xboxProductId
    ? `https://www.xbox.com/en-au/games/store/x/${meta.xboxProductId}`
    : xboxPrice != null
      ? `https://www.xbox.com/en-au/search/results/games?q=${encodeURIComponent(deal.game)}`
      : null;

  const psPrice = meta?.psAuPrice;
  const psState = !meta?.psChecked ? "pending" : psPrice != null ? "price" : "unsold";
  const psLink =
    psPrice != null
      ? `https://store.playstation.com/en-au/search/${encodeURIComponent(deal.game)}`
      : null;

  const allChips = [
    {
      name: "Steam",
      price: steamPrice,
      rrp: steamRrp,
      nativeCurrency: steamIsRealAud ? "AUD" : "USD",
      state: steamPrice != null ? "price" : "unsold",
      link: linkForStore("Steam", steamEntry, deal.steamAppID),
    },
    {
      name: "Xbox Store",
      price: xboxPrice,
      rrp: meta?.xboxAuRrp,
      nativeCurrency: "AUD",
      state: xboxState,
      link: xboxLink,
    },
    {
      name: "PlayStation Store",
      price: psPrice,
      rrp: meta?.psAuRrp,
      nativeCurrency: "AUD",
      state: psState,
      link: psLink,
    },
    ...CURATED_STORES.map((name) => ({
      name,
      price: byName[name]?.price,
      rrp: byName[name]?.rrp,
      nativeCurrency: "USD",
      state: byName[name] != null ? "price" : "unsold",
      link: linkForStore(name, byName[name], deal.steamAppID),
    })),
    {
      name: "G2A",
      state: "search-link",
      link: `https://www.g2a.com/search?query=${encodeURIComponent(deal.game)}`,
    },
    ...deal.stores
      .filter((s) => !["Steam", ...CURATED_STORES].includes(s.store))
      .map((s) => ({
        name: s.store,
        price: s.price,
        rrp: s.rrp,
        nativeCurrency: "USD",
        state: "price",
        link: linkForStore(s.store, s, deal.steamAppID),
      })),
  ];

  const primary = platformOrder
    .map((name) => allChips.find((c) => c.name === name))
    .filter(Boolean);

  const physical = [
    {
      name: "EB Games AU",
      state: "search-link",
      region: "AU",
      link: `https://www.ebgames.com.au/search?q=${encodeURIComponent(deal.game)}`,
    },
    {
      name: "JB Hi-Fi",
      state: "search-link",
      region: "AU",
      link: `https://www.jbhifi.com.au/search?q=${encodeURIComponent(deal.game)}`,
    },
  ];

  const secondary = allChips.filter((c) => !PRIORITY_STORE_NAMES.includes(c.name));

  return { primary, physical, secondary };
}

/**
 * Cheapest store on a common AUD basis (internal yardstick only —
 * display currency is handled separately by formatPrice).
 */
export function getCheapestInfo(deal, meta, rates) {
  if (!deal || !rates) return null;
  const { primary, secondary } = buildStoreRow(deal, meta);
  const priceRows = [...primary, ...secondary].filter((s) => s.state === "price");
  const cheapestRow = priceRows.reduce((best, s) => {
    const audEquivalent = s.nativeCurrency === "AUD" ? s.price : s.price * rates.AUD;
    const bestAudEquivalent = best
      ? best.nativeCurrency === "AUD"
        ? best.price
        : best.price * rates.AUD
      : Infinity;
    return audEquivalent < bestAudEquivalent ? s : best;
  }, null);

  if (cheapestRow) {
    return {
      price: cheapestRow.price,
      rrp: cheapestRow.rrp,
      store: cheapestRow.name,
      nativeCurrency: cheapestRow.nativeCurrency,
    };
  }
  const fallback = deal.stores[0];
  return fallback
    ? {
        price: fallback.price,
        rrp: fallback.rrp,
        store: fallback.store,
        nativeCurrency: "USD",
      }
    : { price: 0, rrp: 0, store: "—", nativeCurrency: "USD" };
}
