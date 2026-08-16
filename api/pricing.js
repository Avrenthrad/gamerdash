// Vercel serverless function — merges several pricing-related proxies
// (xbxprices.js, platprices.js, cheapshark.js, currency.js, plus MTG
// pricing: cardkingdom, tcgaggregator) into one file, purely to stay
// under Vercel's Hobby plan's 12-serverless-function limit. No
// behavior changed for the original four — each keeps its own exact
// logic, just dispatched by ?service= instead of being separate
// files. Same consolidation reasoning as the bungie.js merge.
//
// Usage from the frontend:
//   fetch("/api/pricing?service=xbxprices&endpoint=search&q=...&region=au")
//   fetch("/api/pricing?service=xbxprices&endpoint=game&ppid=...&region=au")
//   fetch("/api/pricing?service=platprices&name=...")
//   fetch("/api/pricing?service=cheapshark&endpoint=games&title=...")
//   fetch("/api/pricing?service=currency")
//   fetch("/api/pricing?service=cardkingdom&scryfallIds=id1,id2,...")
//   fetch("/api/pricing?service=tcgaggregator&...")

const XBXPRICES_BASE = "https://xbxprices.com/api/v2";
const CHEAPSHARK_ALLOWED_ENDPOINTS = ["games", "deals", "stores"];

async function handleXbxprices(searchParams, res) {
  const personalKey = searchParams.get("personalKey");
  const apiKey = personalKey || process.env.XBXPRICES_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });

  const endpoint = searchParams.get("endpoint");
  const region = searchParams.get("region") || "au";

  try {
    let url;
    if (endpoint === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      url = `${XBXPRICES_BASE}/games/search?q=${encodeURIComponent(q)}&region=${region}`;
    } else if (endpoint === "game") {
      const ppid = searchParams.get("ppid");
      if (!ppid) return res.status(400).json({ error: "Missing ppid query parameter" });
      url = `${XBXPRICES_BASE}/games/${ppid}?region=${region}`;
    } else {
      return res.status(400).json({ error: "Missing or invalid endpoint parameter" });
    }

    const xbxRes = await fetch(url, { headers: { "X-API-Key": apiKey } });
    const data = await xbxRes.json();
    if (!xbxRes.ok) {
      console.error("pricing (xbxprices): upstream error", { url, status: xbxRes.status, data });
      return res.status(xbxRes.status).json({ error: "XBXprices request failed", upstream: data });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("pricing (xbxprices): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

async function handlePlatprices(searchParams, res) {
  const name = searchParams.get("name");
  const personalKey = searchParams.get("personalKey");
  const apiKey = personalKey || process.env.PLATPRICES_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });
  if (!name) return res.status(400).json({ error: "Missing name query parameter" });

  try {
    const url = `https://platprices.com/api.php?key=${apiKey}&name=${encodeURIComponent(name)}&region=au`;
    const ppRes = await fetch(url);
    if (!ppRes.ok) return res.status(ppRes.status).json({ error: "PlatPrices API request failed" });
    const data = await ppRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleCheapshark(searchParams, res) {
  const endpoint = searchParams.get("endpoint");
  if (!endpoint || !CHEAPSHARK_ALLOWED_ENDPOINTS.includes(endpoint)) {
    console.error("pricing (cheapshark): bad endpoint", { endpoint });
    return res.status(400).json({ error: "Missing or invalid endpoint parameter", received: endpoint || null });
  }

  // Strip the routing params so only CheapShark's own real params
  // pass through to the upstream URL.
  searchParams.delete("endpoint");
  searchParams.delete("service");
  const query = searchParams.toString();
  const url = `https://www.cheapshark.com/api/1.0/${endpoint}${query ? `?${query}` : ""}`;

  try {
    const csRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Lykodex/1.0)", "Accept": "application/json" },
    });
    if (!csRes.ok) {
      const bodyText = await csRes.text().catch(() => "");
      console.error("pricing (cheapshark): upstream request failed", { url, status: csRes.status, body: bodyText.slice(0, 500) });
      return res.status(csRes.status).json({ error: "CheapShark request failed", upstreamStatus: csRes.status, upstreamBody: bodyText.slice(0, 500) });
    }
    const data = await csRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("pricing (cheapshark): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- Card Kingdom (real public MTG singles pricelist, no key needed) ----------
// Verified live: https://api.cardkingdom.com/api/pricelist returns a
// real, public, ~45MB JSON pricelist covering Card Kingdom's actual
// MTG singles inventory, each entry carrying a real scryfall_id — no
// fuzzy name matching needed. Confirmed real field names by fetching
// it directly, not guessed. This does NOT include sealed product —
// checked the data for booster/box entries and found none; sealed
// pricing isn't available through this feed, so this project doesn't
// claim it.
//
// The file is too large to fetch+parse on every single card lookup,
// so it's cached in this function's own memory (persists across warm
// invocations on Vercel, not across cold starts) for 12h — retail
// prices don't move meaningfully faster than that, and this is a
// shared cache serving every user's lookups, not per-user.
const CARD_KINGDOM_URL = "https://api.cardkingdom.com/api/pricelist";
const CARD_KINGDOM_TTL_MS = 12 * 60 * 60 * 1000;
let ckCache = null; // { byScryfallId: Map<string, Array<entry>>, fetchedAt: number, asOf: string }

async function loadCardKingdomIndex() {
  if (ckCache && Date.now() - ckCache.fetchedAt < CARD_KINGDOM_TTL_MS) return ckCache;

  const ckRes = await fetch(CARD_KINGDOM_URL, { headers: { "User-Agent": "Lykodex/1.0 (+https://gamerdash.vercel.app)" } });
  if (!ckRes.ok) throw new Error(`Card Kingdom pricelist request failed (${ckRes.status})`);
  const json = await ckRes.json();

  const byScryfallId = new Map();
  for (const entry of json.data || []) {
    if (!entry.scryfall_id) continue;
    const trimmed = {
      name: entry.name,
      variation: entry.variation,
      edition: entry.edition,
      isFoil: entry.is_foil === "true",
      priceRetail: entry.price_retail !== null && entry.price_retail !== "" ? Number(entry.price_retail) : null,
      qtyRetail: entry.qty_retail,
      url: entry.url ? `https://www.cardkingdom.com/${entry.url}` : null,
    };
    const list = byScryfallId.get(entry.scryfall_id) || [];
    list.push(trimmed);
    byScryfallId.set(entry.scryfall_id, list);
  }

  ckCache = { byScryfallId, fetchedAt: Date.now(), asOf: json.meta?.created_at || null };
  return ckCache;
}

async function handleCardKingdom(searchParams, res) {
  const idsParam = searchParams.get("scryfallIds");
  if (!idsParam) return res.status(400).json({ error: "Missing scryfallIds query parameter" });
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 75);

  try {
    const index = await loadCardKingdomIndex();
    const results = {};
    for (const id of ids) {
      const entries = index.byScryfallId.get(id);
      if (entries) results[id] = entries;
    }
    return res.status(200).json({ asOf: index.asOf, results });
  } catch (err) {
    console.error("pricing (cardkingdom): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- Multi-game TCG aggregator (Pokemon/Yu-Gi-Oh/One Piece/Riftbound) ----------
// No specific real provider has been named or verified for this yet.
// This project's own hard rule is to never guess an API's real
// endpoint/field names (learned from a real Fortnite pricing bug
// earlier in this project) — so rather than wire a fabricated
// integration against a made-up shape, this stays an honest
// "not configured" response even once TCGAPI_KEY is set, until a real
// provider is named and its docs are actually verified against a live
// response the way cardkingdom above was.
async function handleTcgAggregator(res) {
  const apiKey = process.env.TCGAPI_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });
  return res.status(200).json({
    error: "not_configured",
    message: "TCGAPI_KEY is set, but no real multi-game pricing provider is wired yet — see handleTcgAggregator in api/pricing.js.",
  });
}

async function handleCurrency(res) {
  try {
    const url = "https://api.frankfurter.app/latest?from=USD&to=AUD,CAD,NZD,GBP,EUR";
    const fxRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Lykodex/1.0)", "Accept": "application/json" },
    });
    if (!fxRes.ok) return res.status(fxRes.status).json({ error: "Exchange rate request failed" });
    const data = await fxRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  // Parsing from req.url rather than req.query — cheapshark.js's
  // original comment noted req.query was unreliable under some
  // vercel dev setups, keeping the same safer approach here.
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const service = searchParams.get("service");

  if (service === "xbxprices") return handleXbxprices(searchParams, res);
  if (service === "platprices") return handlePlatprices(searchParams, res);
  if (service === "cheapshark") return handleCheapshark(searchParams, res);
  if (service === "currency") return handleCurrency(res);
  if (service === "cardkingdom") return handleCardKingdom(searchParams, res);
  if (service === "tcgaggregator") return handleTcgAggregator(res);

  return res.status(400).json({ error: "Missing or invalid service parameter" });
}
