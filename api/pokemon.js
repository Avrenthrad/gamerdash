// Vercel serverless function — proxies pokemontcg.io's real, free
// Pokémon TCG card API. Confirmed live (not guessed): 20,000+ real
// cards, real TCGplayer + Cardmarket pricing (recently updated at time
// of verification), real per-format legalities. Works keylessly
// (1,000 requests/day, 30/min) or with a free key (20,000/day) via
// POKEMON_TCG_API_KEY — same optional-key pattern as RAWG/XBXprices.
//
// Reliability, confirmed live (not hypothetical): plain name searches
// succeeded 100% of the time during verification, but filtered/broad
// queries (set.id filters, short prefixes) failed with a real 500/502
// roughly 30-40% of the time on identical repeated requests — a real,
// observed intermittent failure rate, worse than api/fab.js's "no
// documented SLA" risk. Mitigated with one retry on a 5xx before
// giving up, on top of the same defensive timeout api/fab.js uses.
//
// /rarities was confirmed live to return a real 500 consistently (not
// transient) — not proxied; the app uses whatever real `rarity` string
// each card already carries instead of a fixed enum.
//
// Usage from the frontend:
//   fetch("/api/pokemon?mode=search&q=...&page=...")
//   fetch("/api/pokemon?mode=card&id=...")
//   fetch("/api/pokemon?mode=sets")
//   fetch("/api/pokemon?mode=set&id=...")
//   fetch("/api/pokemon?mode=types")
//   fetch("/api/pokemon?mode=subtypes")
//   fetch("/api/pokemon?mode=supertypes")

const BASE_URL = "https://api.pokemontcg.io/v2";
const UPSTREAM_TIMEOUT_MS = 8000;

function buildHeaders() {
  const headers = { Accept: "application/json" };
  if (process.env.POKEMON_TCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
  return headers;
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: buildHeaders(), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// One retry on a real 5xx (not on 4xx — a bad request stays bad) or a
// network/timeout error, justified by the observed live failure rate
// above. Still fails honestly if the retry also fails, rather than
// looping indefinitely.
async function fetchWithRetry(url) {
  try {
    const res = await fetchOnce(url);
    if (res.status >= 500) return await fetchOnce(url);
    return res;
  } catch {
    return await fetchOnce(url);
  }
}

function upstreamUnavailable(res, message) {
  return res.status(502).json({
    error: "upstream_unavailable",
    message: message || "Pokémon TCG data is temporarily unavailable.",
  });
}

// Confirmed live: `vercel dev`'s local runtime re-encodes a real
// space's "+" form into a literal "%2B" before this handler sees
// req.url — searchParams.get() then decodes it back to a literal "+"
// character, not a space (real production Vercel and a plain Node
// process don't do this). A literal "+" isn't a real character in any
// Pokémon card name, so normalizing it to a space here is safe.
function cleanParam(value) {
  return value?.replace(/\+/g, " ");
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = cleanParam(searchParams.get("q"));
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const page = searchParams.get("page") || "1";
      const pageSize = searchParams.get("pageSize") || "30";
      const orderBy = searchParams.get("orderBy");
      const params = new URLSearchParams({ q, page, pageSize });
      if (orderBy) params.set("orderBy", orderBy);

      const pokeRes = await fetchWithRetry(`${BASE_URL}/cards?${params.toString()}`);
      if (!pokeRes.ok) return upstreamUnavailable(res, "Pokémon TCG search failed.");
      const data = await pokeRes.json();
      return res.status(200).json(data);
    }

    if (mode === "card") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const pokeRes = await fetchWithRetry(`${BASE_URL}/cards/${encodeURIComponent(id)}`);
      if (pokeRes.status === 404) return res.status(404).json({ error: "Card not found" });
      if (!pokeRes.ok) return upstreamUnavailable(res, "Failed to load this Pokémon card.");
      const data = await pokeRes.json();
      return res.status(200).json(data);
    }

    if (mode === "sets") {
      const pokeRes = await fetchWithRetry(`${BASE_URL}/sets?pageSize=250`);
      if (!pokeRes.ok) return upstreamUnavailable(res, "Failed to list Pokémon sets.");
      const data = await pokeRes.json();
      return res.status(200).json(data);
    }

    if (mode === "set") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const pokeRes = await fetchWithRetry(`${BASE_URL}/sets/${encodeURIComponent(id)}`);
      if (pokeRes.status === 404) return res.status(404).json({ error: "Set not found" });
      if (!pokeRes.ok) return upstreamUnavailable(res, "Failed to load this set.");
      const data = await pokeRes.json();
      return res.status(200).json(data);
    }

    if (mode === "types" || mode === "subtypes" || mode === "supertypes") {
      const pokeRes = await fetchWithRetry(`${BASE_URL}/${mode}`);
      if (!pokeRes.ok) return upstreamUnavailable(res, `Failed to load ${mode}.`);
      const data = await pokeRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("pokemon proxy error:", err);
    return upstreamUnavailable(res, "Pokémon TCG data is temporarily unavailable.");
  }
}
