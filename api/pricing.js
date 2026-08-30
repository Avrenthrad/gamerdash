// Vercel serverless function — merges several pricing-related proxies
// (xbxprices.js, platprices.js, cheapshark.js, currency.js, plus MTG
// pricing: cardkingdom, tcgaggregator, and Rebrickable for LEGO) into
// one file, purely to stay under Vercel's Hobby plan's 12-serverless-
// function limit — /api was already at exactly 12 files when
// Rebrickable was added, so it landed here rather than as its own
// file. No behavior changed for the original services — each keeps
// its own exact logic, just dispatched by ?service= instead of being
// separate files. Same consolidation reasoning as the bungie.js merge.
//
// The lykodex-session service below is genuinely unrelated to pricing
// — it's here purely because this is the file already designated as
// the "merge point to dodge the function-count ceiling," same as
// comicvine/rebrickable before it, not because it belongs here
// conceptually.
//
// Usage from the frontend:
//   fetch("/api/pricing?service=xbxprices&endpoint=search&q=...&region=au")
//   fetch("/api/pricing?service=xbxprices&endpoint=game&ppid=...&region=au")
//   fetch("/api/pricing?service=platprices&name=...")
//   fetch("/api/pricing?service=cheapshark&endpoint=games&title=...")
//   fetch("/api/pricing?service=currency")
//   fetch("/api/pricing?service=cardkingdom&scryfallIds=id1,id2,...")
//   fetch("/api/pricing?service=tcgaggregator&...")
//   fetch("/api/pricing?service=rebrickable&mode=search&q=...")
//   fetch("/api/pricing?service=rebrickable&mode=set&setNum=...")
//   fetch("/api/pricing?service=comicvine&q=...")
//   fetch("/api/pricing?service=riftbound&mode=search&q=...")
//   fetch("/api/pricing?service=riftbound&mode=card&id=...")
//   POST /api/pricing?service=xbox&mode=link, Authorization: Bearer <token>, body {code, redirectUri}
//   POST /api/pricing?service=xbox&mode=gamerscore, Authorization: Bearer <token>
//   POST /api/pricing?service=psn&mode=link, Authorization: Bearer <token>, body {npsso}
//   POST /api/pricing?service=psn&mode=trophies, Authorization: Bearer <token>
//   POST /api/pricing?service=lykodex-session, Authorization: Bearer <caller's access token>

import { allowCors } from "./_cors.js";
import { createClient } from "@supabase/supabase-js";

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
      headers: { "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)", "Accept": "application/json" },
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

  const ckRes = await fetch(CARD_KINGDOM_URL, { headers: { "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)" } });
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

// ---------- JustTCG (real FaB pricing — deferred at launch, same "don't guess" rule as handleTcgAggregator) ----------
// Confirmed real and covering Flesh and Blood (their own homepage FAQ
// names it explicitly among 18 supported games) — genuinely requires
// a key (confirmed live: unauthenticated /v1/cards returns a real 401
// {"error":"API key is required","code":"MISSING_API_KEY"}), sent via
// an `x-api-key` header (confirmed from their own quickstart example),
// not a query param.
//
// Confirmed real response shape from their schema docs: Card has
// {uuid, id, name, game, set, set_name, number, tcgplayerId,
// mtgjsonId, scryfallId, rarity, details, variants[]}, each Variant
// has {uuid, id, printing, condition, price, lastUpdated} — a single
// real `price` number per variant, not a low/mid/high spread like
// Pokémon TCG's TCGplayer data.
//
// NOT wired to a real search call: the exact query parameter names
// for searching cards by name/game (as opposed to looking one up by
// a known id) are not confirmed anywhere accessible without a real
// key — their docs page describes "9 search params" without naming
// them. This project has a real, hard-learned rule against guessing
// an API's endpoint/param shape (a past Fortnite pricing bug came
// from doing exactly that) — same as handleTcgAggregator above, this
// stays an honest "not_configured" once a key is set, until the real
// param names are confirmed against a live authenticated response.
async function handleJustTcg(res) {
  const apiKey = process.env.JUSTTCG_API_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });
  return res.status(200).json({
    error: "not_configured",
    message: "JUSTTCG_API_KEY is set, but the real search parameter names haven't been confirmed against a live response yet — see handleJustTcg in api/pricing.js.",
  });
}

// ---------- Rebrickable (real LEGO set database) ----------
// Confirmed live that Rebrickable genuinely requires authentication —
// a real keyless request to /lego/sets/ returns a real 401 "Authentication
// credentials were not provided." Field names (set_num, name, year,
// theme_id, num_parts, set_img_url) and endpoint shapes
// (/lego/sets/?search=..., /lego/sets/{set_num}/) are confirmed against
// Rebrickable's own real API docs and a community client library's
// README, NOT guessed — but not spot-checked against a real
// authenticated response (no key held while building this), so treat
// the exact field list as the best real information available rather
// than 100% verified, and double check once REBRICKABLE_KEY is set.
const REBRICKABLE_BASE = "https://rebrickable.com/api/v3/lego";

async function handleRebrickable(searchParams, res) {
  const apiKey = process.env.REBRICKABLE_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });

  const mode = searchParams.get("mode");
  const headers = { Authorization: `key ${apiKey}` };

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const url = `${REBRICKABLE_BASE}/sets/?search=${encodeURIComponent(q)}&page_size=20&ordering=-year`;
      const rbRes = await fetch(url, { headers });
      if (!rbRes.ok) return res.status(rbRes.status).json({ error: "Rebrickable search failed" });
      const data = await rbRes.json();
      return res.status(200).json(data);
    }

    if (mode === "set") {
      const setNum = searchParams.get("setNum");
      if (!setNum) return res.status(400).json({ error: "Missing setNum query parameter" });
      const url = `${REBRICKABLE_BASE}/sets/${encodeURIComponent(setNum)}/`;
      const rbRes = await fetch(url, { headers });
      if (rbRes.status === 404) return res.status(404).json({ error: "Set not found" });
      if (!rbRes.ok) return res.status(rbRes.status).json({ error: "Rebrickable lookup failed" });
      const data = await rbRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("pricing (rebrickable): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- Comic Vine (real, general comics database — all publishers) ----------
// Confirmed live that Comic Vine genuinely requires a key (a real
// unauthenticated request returns a real 401 with a clean
// {"error":"Invalid API Key",...} body) and confirmed via their real
// API documentation (not guessed) that /search issue fields include:
// aliases, api_detail_url, cover_date, date_added, date_last_updated,
// deck, description, has_staff_review, id, image, issue_number, name,
// site_detail_url, store_date, volume. The docs page didn't spell out
// image's own sub-fields, so multiple real candidate keys
// (medium_url/small_url/thumb_url) are tried with fallbacks client-side
// rather than assuming one. Confirmed live: Comic Vine sends no CORS
// headers, so this must be proxied (unlike Discogs) — it's here rather
// than its own file because /api was already at Vercel's 12-function
// cap when this was added.
const COMIC_VINE_BASE = "https://comicvine.gamespot.com/api";

async function handleComicVine(searchParams, res) {
  const apiKey = process.env.COMIC_VINE_KEY;
  if (!apiKey) return res.status(200).json({ error: "no_key" });

  const q = searchParams.get("q");
  if (!q) return res.status(400).json({ error: "Missing q query parameter" });

  try {
    const url = `${COMIC_VINE_BASE}/search/?api_key=${apiKey}&format=json&query=${encodeURIComponent(q)}&resources=issue&limit=10`;
    const cvRes = await fetch(url, { headers: { "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)" } });
    if (!cvRes.ok) return res.status(cvRes.status).json({ error: "Comic Vine request failed" });
    const data = await cvRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("pricing (comicvine): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- Riftbound (real card data via Riftcodex, community API) ----------
// Confirmed live: api.riftcodex.com sends no CORS headers at all
// (unlike its TCG-College neighbors YGOPRODeck and optcgapi.com, both
// of which send Access-Control-Allow-Origin: * and so are called
// directly from lib/yugioh.js/lib/onepiece.js with no proxy) — so this
// one has to be proxied. Confirmed real endpoints against a live
// response, not guessed: GET /cards/name?fuzzy=<query> for search, GET
// /cards/{id} for a single lookup by Riftcodex's own real id. No real
// pricing field exists on the card object (has a tcgplayer_id, but no
// embedded price) — same honest situation Flesh and Blood is in.
//
// Confirmed live: Riftcodex (Cloudflare-fronted) returns a real 403 to
// requests actually originating from Vercel's infrastructure, while
// identical requests from elsewhere succeed. Tried the same
// User-Agent fix that resolves this for Card Kingdom/Comic Vine above
// — confirmed live (retested against the real deployed endpoint,
// several minutes after deploy) that it does NOT fix this one, so
// this is very likely an IP/ASN-range block on Vercel's egress IPs
// specifically, not a header-based bot check — a header can't route
// around that. This service is currently NON-FUNCTIONAL in production
// as a result (works fine calling api.riftcodex.com directly from
// outside Vercel, which is how it was verified while building this).
// Real remaining options, none attempted yet: ask Riftcodex
// (support@riftcodex.com, per its own OpenAPI contact) to allowlist
// Vercel's ranges; proxy through a non-Vercel host instead; or proxy
// through a Cloudflare Worker (Riftcodex is also Cloudflare-fronted,
// so that path may not trip the same block — unverified guess, not
// confirmed).
const RIFTCODEX_BASE = "https://api.riftcodex.com";
const RIFTCODEX_HEADERS = { Accept: "application/json", "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)" };

async function handleRiftbound(searchParams, res) {
  const mode = searchParams.get("mode");

  try {
    if (mode === "search") {
      const q = searchParams.get("q");
      if (!q) return res.status(400).json({ error: "Missing q query parameter" });
      const url = `${RIFTCODEX_BASE}/cards/name?fuzzy=${encodeURIComponent(q)}`;
      const rcRes = await fetch(url, { headers: RIFTCODEX_HEADERS });
      if (!rcRes.ok) {
        const bodyText = await rcRes.text().catch(() => "");
        console.error("pricing (riftbound): search upstream error", { url, status: rcRes.status, body: bodyText.slice(0, 300) });
        return res.status(rcRes.status).json({ error: "Riftbound search failed" });
      }
      const data = await rcRes.json();
      return res.status(200).json(data);
    }

    if (mode === "card") {
      const id = searchParams.get("id");
      if (!id) return res.status(400).json({ error: "Missing id query parameter" });
      const url = `${RIFTCODEX_BASE}/cards/${encodeURIComponent(id)}`;
      const rcRes = await fetch(url, { headers: RIFTCODEX_HEADERS });
      if (rcRes.status === 404) return res.status(404).json({ error: "Card not found" });
      if (!rcRes.ok) {
        const bodyText = await rcRes.text().catch(() => "");
        console.error("pricing (riftbound): card upstream error", { url, status: rcRes.status, body: bodyText.slice(0, 300) });
        return res.status(rcRes.status).json({ error: "Riftbound lookup failed" });
      }
      const data = await rcRes.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("pricing (riftbound): fetch threw", err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- Xbox Live (real Gamerscore via Microsoft OAuth + XSTS) ----------
// Real 3-step exchange confirmed against OpenXbox/xbox-webapi-python's
// actual working implementation (not guessed): (1) authorization code
// -> Microsoft OAuth2 token at login.live.com, (2) that access token
// -> an Xbox Live "user token" at user.auth.xboxlive.com, (3) the user
// token -> an XSTS token at xsts.auth.xboxlive.com (this step also
// hands back userhash/xuid/gamertag via DisplayClaims.xui[0]). The
// XSTS token authorizes calls to the real Xbox Live API
// (profile.xboxlive.com) via `Authorization: XBL3.0 x=<userhash>;<token>`.
//
// Tokens are stored server-side only (xbox_tokens table, no RLS
// policies granted — service_role only, same posture as the
// lykodex-session endpoint above) and never sent to the client.
async function xboxOAuthTokenRequest(params) {
  // Deliberately the SAME env var lib/xboxOAuth.js reads client-side
  // (VITE_MICROSOFT_CLIENT_ID), not a separate server-only name — the
  // client ID isn't a secret, and Vercel's serverless runtime still
  // has VITE_-prefixed vars in process.env regardless (that prefix
  // only controls what Vite inlines into the browser bundle). Using
  // two different names here was a real bug: the token exchange
  // silently sent client_id="" (process.env.MICROSOFT_CLIENT_ID was
  // never actually set by anyone, since setup instructions only ever
  // said to set VITE_MICROSOFT_CLIENT_ID), which Microsoft correctly
  // rejected as "the client does not exist."
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const body = new URLSearchParams({ ...params, client_id: clientId });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Microsoft OAuth token request failed: ${data.error_description || data.error || res.status}`);
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function xboxRequestUserToken(msAccessToken) {
  const res = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-xbl-contract-version": "1" },
    body: JSON.stringify({
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
      Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msAccessToken}` },
    }),
  });
  if (!res.ok) throw new Error(`Xbox Live user token request failed (${res.status})`);
  return res.json(); // { Token, DisplayClaims: { xui: [...] } }
}

async function xboxRequestXstsToken(userToken) {
  const res = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-xbl-contract-version": "1" },
    body: JSON.stringify({
      RelyingParty: "http://xboxlive.com",
      TokenType: "JWT",
      Properties: { UserTokens: [userToken], SandboxId: "RETAIL" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Xbox Live XSTS authorize failed (${res.status}): ${data?.XErr || ""}`);
  return data; // { Token, DisplayClaims: { xui: [{ xid, uhs, gtg, ... }] } }
}

async function xboxFetchGamerscore(userhash, xstsToken) {
  const res = await fetch("https://profile.xboxlive.com/users/me/profile/settings?settings=Gamerscore,Gamertag", {
    headers: {
      "x-xbl-contract-version": "3",
      Authorization: `XBL3.0 x=${userhash};${xstsToken}`,
    },
  });
  if (!res.ok) throw new Error(`Xbox Live profile request failed (${res.status})`);
  const data = await res.json();
  const settings = data?.profileUsers?.[0]?.settings || [];
  const get = (id) => settings.find((s) => s.id === id)?.value;
  return { gamerscore: Number(get("Gamerscore")) || 0, gamertag: get("Gamertag") || null };
}

// Verifies the caller against their own Supabase session (same pattern
// as handleLykodexSession above) and returns a service_role admin
// client for reading/writing this user's stored tokens.
async function verifyCallerAndGetAdminClient(req) {
  const authHeader = req.headers.authorization || "";
  const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!callerToken) throw Object.assign(new Error("Missing Authorization bearer token"), { status: 401 });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw Object.assign(new Error("Server not configured for this"), { status: 500 });
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerData, error: callerError } = await anonClient.auth.getUser(callerToken);
  if (callerError || !callerData?.user) throw Object.assign(new Error("Invalid session"), { status: 401 });

  return { userId: callerData.user.id, adminClient };
}

async function handleXbox(req, searchParams, res) {
  const mode = searchParams.get("mode");

  try {
    if (mode === "link") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);
      const { code, redirectUri } = req.body || {};
      if (!code || !redirectUri) return res.status(400).json({ error: "Missing code or redirectUri" });

      const oauth = await xboxOAuthTokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, scope: "Xboxlive.signin Xboxlive.offline_access" });
      const userTokenResp = await xboxRequestUserToken(oauth.access_token);
      const xsts = await xboxRequestXstsToken(userTokenResp.Token);
      const claims = xsts.DisplayClaims.xui[0];
      const { gamerscore, gamertag } = await xboxFetchGamerscore(claims.uhs, xsts.Token);

      const now = Date.now();
      const { error: upsertError } = await adminClient.from("xbox_tokens").upsert({
        user_id: userId,
        ms_access_token: oauth.access_token,
        ms_refresh_token: oauth.refresh_token || null,
        ms_expires_at: new Date(now + oauth.expires_in * 1000).toISOString(),
        xsts_token: xsts.Token,
        xsts_expires_at: xsts.NotAfter,
        userhash: claims.uhs,
        xuid: claims.xid,
        gamertag: gamertag || claims.gtg || null,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

      return res.status(200).json({ gamertag: gamertag || claims.gtg, gamerscore });
    }

    if (mode === "gamerscore") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);

      const { data: stored, error: fetchError } = await adminClient.from("xbox_tokens").select("*").eq("user_id", userId).maybeSingle();
      if (fetchError) throw fetchError;
      if (!stored) return res.status(404).json({ error: "Xbox not linked" });

      let { userhash, xuid, xsts_token: xstsToken } = stored;
      const xstsExpired = new Date(stored.xsts_expires_at).getTime() < Date.now();
      const msExpired = new Date(stored.ms_expires_at).getTime() < Date.now();

      if (xstsExpired) {
        let msAccessToken = stored.ms_access_token;
        let newMsFields = null;
        if (msExpired) {
          if (!stored.ms_refresh_token) return res.status(401).json({ error: "Xbox link expired — please re-link" });
          const refreshed = await xboxOAuthTokenRequest({ grant_type: "refresh_token", refresh_token: stored.ms_refresh_token, scope: "Xboxlive.signin Xboxlive.offline_access" });
          msAccessToken = refreshed.access_token;
          newMsFields = {
            ms_access_token: refreshed.access_token,
            ms_refresh_token: refreshed.refresh_token || stored.ms_refresh_token,
            ms_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          };
        }
        const userTokenResp = await xboxRequestUserToken(msAccessToken);
        const xsts = await xboxRequestXstsToken(userTokenResp.Token);
        const claims = xsts.DisplayClaims.xui[0];
        userhash = claims.uhs;
        xuid = claims.xid;
        xstsToken = xsts.Token;
        await adminClient.from("xbox_tokens").update({
          ...(newMsFields || {}),
          xsts_token: xsts.Token,
          xsts_expires_at: xsts.NotAfter,
          userhash: claims.uhs,
          xuid: claims.xid,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      }

      const { gamerscore, gamertag } = await xboxFetchGamerscore(userhash, xstsToken);
      if (gamertag) await adminClient.from("xbox_tokens").update({ gamertag }).eq("user_id", userId);
      return res.status(200).json({ gamertag: gamertag || stored.gamertag, gamerscore, xuid });
    }

    if (mode === "unlink") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);
      const { error: deleteError } = await adminClient.from("xbox_tokens").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("pricing (xbox):", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

// ---------- PlayStation Network (real trophy counts via npsso) ----------
// Real npsso -> access code -> access/refresh token exchange confirmed
// against achievements-app/psn-api's actual working implementation
// (not guessed) — Sony offers no public OAuth app registration path,
// so this is the same unofficial-but-real mechanism every PSN trophy
// tracker (PSNProfiles etc.) uses. The npsso itself is a 64-char
// session-cookie value the person copies from their own browser after
// signing into ca.account.sony.com — equivalent to a password, never
// logged, never stored (only the resulting access/refresh tokens are).
//
// The client_id/client_secret/redirect_uri/scope values below are
// PSN's own fixed, public mobile-app OAuth client (confirmed real —
// every implementation of this flow uses the exact same constants,
// they are not something Lykodex registered).
const PSN_AUTH_BASE = "https://ca.account.sony.com/api/authz/v3/oauth";
const PSN_CLIENT_AUTH_HEADER = "Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=";
const PSN_REDIRECT_URI = "com.scee.psxandroid.scecompcall://redirect";

async function psnExchangeNpssoForAccessCode(npsso) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: "09515159-7237-4370-9b40-3806e67c0891",
    redirect_uri: PSN_REDIRECT_URI,
    response_type: "code",
    scope: "psn:mobile.v2.core psn:clientapp",
  });
  const res = await fetch(`${PSN_AUTH_BASE}/authorize?${params.toString()}`, {
    headers: { Cookie: `npsso=${npsso}` },
    redirect: "manual",
  });
  const location = res.headers.get("location");
  if (!location || !location.includes("?code=")) {
    throw new Error("Couldn't get a PSN access code — the npsso token may be invalid or expired.");
  }
  return new URLSearchParams(location.split("redirect/")[1]).get("code");
}

async function psnExchangeAccessCodeForTokens(accessCode) {
  const res = await fetch(`${PSN_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: PSN_CLIENT_AUTH_HEADER },
    body: new URLSearchParams({ code: accessCode, redirect_uri: PSN_REDIRECT_URI, grant_type: "authorization_code", token_format: "jwt" }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PSN token exchange failed: ${data.error_description || data.error || res.status}`);
  return data; // { access_token, refresh_token, expires_in, refresh_token_expires_in, ... }
}

async function psnRefreshTokens(refreshToken) {
  const res = await fetch(`${PSN_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: PSN_CLIENT_AUTH_HEADER },
    body: new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token", token_format: "jwt", scope: "psn:mobile.v2.core psn:clientapp" }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PSN token refresh failed: ${data.error_description || data.error || res.status}`);
  return data;
}

async function psnFetchTrophySummary(accessToken) {
  const res = await fetch("https://m.np.playstation.com/api/trophy/v1/users/me/trophySummary", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`PSN trophy summary request failed (${res.status})`);
  return res.json(); // { accountId, trophyLevel, earnedTrophies: { bronze, silver, gold, platinum } }
}

async function handlePsn(req, searchParams, res) {
  const mode = searchParams.get("mode");

  try {
    if (mode === "link") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);
      const { npsso } = req.body || {};
      if (!npsso) return res.status(400).json({ error: "Missing npsso" });

      const accessCode = await psnExchangeNpssoForAccessCode(npsso);
      const tokens = await psnExchangeAccessCodeForTokens(accessCode);
      const summary = await psnFetchTrophySummary(tokens.access_token);

      const now = Date.now();
      const { error: upsertError } = await adminClient.from("psn_tokens").upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
        refresh_expires_at: new Date(now + tokens.refresh_token_expires_in * 1000).toISOString(),
        account_id: summary.accountId || null,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

      return res.status(200).json({ trophies: summary.earnedTrophies });
    }

    if (mode === "trophies") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);

      const { data: stored, error: fetchError } = await adminClient.from("psn_tokens").select("*").eq("user_id", userId).maybeSingle();
      if (fetchError) throw fetchError;
      if (!stored) return res.status(404).json({ error: "PlayStation not linked" });

      let accessToken = stored.access_token;
      if (new Date(stored.access_expires_at).getTime() < Date.now()) {
        if (new Date(stored.refresh_expires_at).getTime() < Date.now()) {
          return res.status(401).json({ error: "PlayStation link expired — please re-link with a fresh npsso" });
        }
        const refreshed = await psnRefreshTokens(stored.refresh_token);
        accessToken = refreshed.access_token;
        const now = Date.now();
        await adminClient.from("psn_tokens").update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token || stored.refresh_token,
          access_expires_at: new Date(now + refreshed.expires_in * 1000).toISOString(),
          refresh_expires_at: new Date(now + refreshed.refresh_token_expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      }

      const summary = await psnFetchTrophySummary(accessToken);
      return res.status(200).json({ trophies: summary.earnedTrophies });
    }

    if (mode === "unlink") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const { userId, adminClient } = await verifyCallerAndGetAdminClient(req);
      const { error: deleteError } = await adminClient.from("psn_tokens").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Missing or invalid mode parameter" });
  } catch (err) {
    console.error("pricing (psn):", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

// Real session swap for the "act as Lykodex" toggle — not a client-
// side pretend-toggle, since RLS needs a genuine auth.uid() to enforce
// anything anywhere. The service_role key bypasses RLS entirely, so
// this endpoint's whole job is verifying, server-side, that the
// caller is actually the one registered delegate BEFORE ever touching
// it — never trust a client-supplied "I'm allowed" flag for this.
//
// Flow: verify the caller's own access token names a real user (via a
// plain anon-key client — this step never needs service_role) ->
// check that user's id against profiles.lykodex_delegate_user_id on
// the Lykodex account (a service_role read, since the caller can't
// read someone else's profile row under normal RLS) -> if it matches,
// admin.generateLink() a one-time magic-link token for the Lykodex
// account and immediately redeem it via verifyOtp() on a plain
// anon-key client, which hands back a genuine session (access +
// refresh token) for the Lykodex account. The client then calls
// supabase.auth.setSession() with that to actually swap sessions.
async function handleLykodexSession(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const authHeader = req.headers.authorization || "";
  const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!callerToken) return res.status(401).json({ error: "Missing Authorization bearer token" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("pricing (lykodex-session): missing Supabase env vars");
    return res.status(500).json({ error: "Server not configured for this" });
  }

  const anonClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: callerData, error: callerError } = await anonClient.auth.getUser(callerToken);
  if (callerError || !callerData?.user) return res.status(401).json({ error: "Invalid session" });

  const LYKODEX_EMAIL = "system@lykodex.internal";

  const { data: lykodexProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, lykodex_delegate_user_id")
    .eq("username", "Lykodex")
    .single();
  if (profileError || !lykodexProfile) {
    console.error("pricing (lykodex-session): couldn't load Lykodex profile", profileError);
    return res.status(500).json({ error: "Lykodex account not found" });
  }

  if (lykodexProfile.lykodex_delegate_user_id !== callerData.user.id) {
    return res.status(403).json({ error: "Not authorized to act as Lykodex" });
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: LYKODEX_EMAIL,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("pricing (lykodex-session): generateLink failed", linkError);
    return res.status(500).json({ error: "Couldn't create a Lykodex session" });
  }

  const { data: sessionData, error: verifyError } = await anonClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyError || !sessionData?.session) {
    console.error("pricing (lykodex-session): verifyOtp failed", verifyError);
    return res.status(500).json({ error: "Couldn't create a Lykodex session" });
  }

  return res.status(200).json({ session: sessionData.session });
}

async function handleCurrency(res) {
  try {
    const url = "https://api.frankfurter.app/latest?from=USD&to=AUD,CAD,NZD,GBP,EUR";
    const fxRes = await fetch(url, {
      headers: { "User-Agent": "Lykodex/1.0 (+https://lykodex.vercel.app)", "Accept": "application/json" },
    });
    if (!fxRes.ok) return res.status(fxRes.status).json({ error: "Exchange rate request failed" });
    const data = await fxRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  allowCors(res);
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
  if (service === "rebrickable") return handleRebrickable(searchParams, res);
  if (service === "comicvine") return handleComicVine(searchParams, res);
  if (service === "justtcg") return handleJustTcg(res);
  if (service === "riftbound") return handleRiftbound(searchParams, res);
  if (service === "xbox") return handleXbox(req, searchParams, res);
  if (service === "psn") return handlePsn(req, searchParams, res);
  if (service === "lykodex-session") return handleLykodexSession(req, res);

  return res.status(400).json({ error: "Missing or invalid service parameter" });
}
