// Vercel serverless function — proxies goagain.dev's real, free,
// keyless Flesh and Blood card API. Confirmed live (not guessed) via
// its own /health and /openapi.yaml, plus real curl requests against
// /v1/cards, /v1/cards/{id}, /v1/cards/{id}/legality, and /v1/sets —
// see the field notes below and the plan this was built from.
//
// Unlike Scryfall (which has a documented rate-limit policy and years
// of production use across the MTG dev community), goagain.dev is a
// small third-party project with no documented uptime/rate-limit SLA.
// Two things below exist specifically to handle that honestly, that
// api/scryfall.js doesn't need:
//   1. Every upstream fetch has an abort timeout, so a hung goagain
//      request fails fast instead of hanging the page.
//   2. Upstream failures return a distinct { error: "upstream_unavailable" }
//      shape (mirrors api/pricing.js's handleTcgAggregator stub) so the
//      client can show an honest "temporarily unavailable" state
//      instead of a blank list or an unhandled rejection.
//
// Proxied anyway (even though no key needs protecting) purely for
// architectural consistency with every other integration in this
// project, and so caching/error-handling stays in one place.
//
// Usage from the frontend:
//   fetch("/api/fab?mode=search&name=...&type=...&class=...&set=...&pitch=...&cost=...&power=...&defense=...&rarity=...&keyword=...&limit=...&offset=...")
//   fetch("/api/fab?mode=card&id=...")
//   fetch("/api/fab?mode=legality&id=...")
//   fetch("/api/fab?mode=sets")
//   fetch("/api/fab?mode=set&id=...")
//   fetch("/api/fab?mode=keywords")
//   fetch("/api/fab?mode=keyword&name=...")

const BASE_URL = "https://api.goagain.dev";
const UPSTREAM_TIMEOUT_MS = 8000;

const FAB_HEADERS = {
  "User-Agent": "Lykodex/1.0 (+https://gamerdash.vercel.app)",
  Accept: "application/json",
};

// No documented rate-limit/SLA for goagain.dev — fail fast rather than
// let a hung request hang the whole page.
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: FAB_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function upstreamUnavailable(res, message) {
  return res.status(502).json({
    error: "upstream_unavailable",
    message: message || "Flesh and Blood data is temporarily unavailable.",
  });
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    // Real search filters confirmed live: name (prefix match, good
    // enough for live-typing) and type both verified via curl. class,
    // set, pitch, cost, power, defense, rarity, keyword are per
    // goagain's own published OpenAPI spec (fetched live, not guessed)
    // but not individually curl-tested — pass through as-is; an unknown
    // param name is simply ignored by goagain rather than erroring.
    if (mode === "search") {
      const params = new URLSearchParams();
      for (const key of ["name", "type", "class", "set", "pitch", "cost", "power", "defense", "rarity", "keyword"]) {
        // Confirmed live: `vercel dev`'s local runtime re-encodes a
        // real space's "+" form (from the browser's own
        // URLSearchParams.toString()) into a literal "%2B" before this
        // handler ever sees req.url — so searchParams.get(key) here
        // decodes it back to a literal "+" CHARACTER, not a space (a
        // plain Node process, and real production Vercel, don't do
        // this — isolated and reproduced specifically to `vercel dev`).
        // A literal "+" is not a real character in any Flesh and Blood
        // card name, so treating it as a mangled space here is a safe
        // defensive normalization, not a semantic risk.
        const value = searchParams.get(key)?.replace(/\+/g, " ");
        if (value) params.set(key, value);
      }
      // Confirmed live: goagain paginates with limit/offset, NOT page
      // (unlike Scryfall) — verified via a real request returning
      // { data, total, limit, offset }.
      params.set("limit", searchParams.get("limit") || "30");
      params.set("offset", searchParams.get("offset") || "0");

      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/cards?${params.toString()}`);
      if (!fabRes.ok) return upstreamUnavailable(res, "Flesh and Blood search failed.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    if (mode === "card") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/cards/${encodeURIComponent(id)}`);
      if (fabRes.status === 404) return res.status(404).json({ error: "Card not found" });
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to load this Flesh and Blood card.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    // Real per-format legality, confirmed live to be a richer/more
    // authoritative shape than the card object's own boolean flags for
    // upf specifically (upf_legal doesn't exist on the card object at
    // all, but this endpoint returns it) — kept as its own mode so
    // callers can choose which shape they need.
    if (mode === "legality") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/cards/${encodeURIComponent(id)}/legality`);
      if (fabRes.status === 404) return res.status(404).json({ error: "Card not found" });
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to load legality for this card.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    // Every real FaB set — confirmed live to include a real set_logo
    // image per printing/edition of the set itself, plus release dates
    // and out-of-print status.
    if (mode === "sets") {
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/sets`);
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to list Flesh and Blood sets.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    if (mode === "set") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/sets/${encodeURIComponent(id)}`);
      if (fabRes.status === 404) return res.status(404).json({ error: "Set not found" });
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to load this set.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    if (mode === "keywords") {
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/keywords`);
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to list keywords.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    if (mode === "keyword") {
      const name = searchParams.get("name");
      if (!name) return res.status(400).json({ error: "Missing name query parameter" });
      const fabRes = await fetchWithTimeout(`${BASE_URL}/v1/keywords/${encodeURIComponent(name)}`);
      if (fabRes.status === 404) return res.status(404).json({ error: "Keyword not found" });
      if (!fabRes.ok) return upstreamUnavailable(res, "Failed to load this keyword.");
      const data = await fabRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    // AbortError from the timeout lands here too — same honest shape
    // either way, the client doesn't need to distinguish "timed out"
    // from "errored".
    console.error("fab proxy error:", err);
    return upstreamUnavailable(res, "Flesh and Blood data is temporarily unavailable.");
  }
}
