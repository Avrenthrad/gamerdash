// Vercel serverless function — merges four separate pricing-related
// proxies (xbxprices.js, platprices.js, cheapshark.js, currency.js)
// into one file, purely to stay under Vercel's Hobby plan's
// 12-serverless-function limit. No behavior changed for any of the
// four — each keeps its own exact logic, just dispatched by
// ?service= instead of being four separate files. Same consolidation
// reasoning as the bungie.js merge.
//
// Usage from the frontend:
//   fetch("/api/pricing?service=xbxprices&endpoint=search&q=...&region=au")
//   fetch("/api/pricing?service=xbxprices&endpoint=game&ppid=...&region=au")
//   fetch("/api/pricing?service=platprices&name=...")
//   fetch("/api/pricing?service=cheapshark&endpoint=games&title=...")
//   fetch("/api/pricing?service=currency")

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

  return res.status(400).json({ error: "Missing or invalid service parameter" });
}
