// Vercel serverless function — real OAuth 2.0 flow against Bungie's
// API (Destiny 2), plus the authenticated Eververse vendor lookup.
// Merged from two separate files (bungie-auth.js + bungie.js) purely
// to stay under Vercel's Hobby plan's 12-serverless-function limit —
// no behavior changed, just consolidated under one ?action= dispatch,
// same pattern already used for Scryfall/TMDB/AniList/Open5e.
//
// Tokens are stored in httpOnly cookies rather than React state or
// localStorage — this survives a page refresh and isn't readable by
// client-side JS, which matters more here since these are real access
// tokens, not just a display preference.
//
// Actions:
//   ?action=authorize  -> redirects the browser to Bungie's OAuth screen
//   ?action=callback   -> Bungie redirects back here with a code; exchange it for tokens
//   ?action=status     -> tells the frontend whether a valid session cookie exists
//   ?action=logout     -> clears the cookies
//   ?action=vendor      (or no action, for backward compat) -> Eververse sales lookup
//
// NOTE ON THE EVERVERSE VENDOR HASH: 3361454721 is the commonly-cited
// hash for the Eververse vendor (Tess Everis) in the Destiny community
// — not independently verified against a live API call, flag it if
// the vendor call comes back empty/wrong once tested.
//
// NOTE ON ITEM NAMES: the vendor sales response only gives numeric
// itemHash values, not human-readable names/icons — resolving those
// needs Bungie's "Manifest" (a large downloadable definitions
// database), which isn't wired up yet. This is the groundwork, not
// the finished feature.

const TOKEN_URL = "https://www.bungie.net/platform/app/oauth/token/";
const AUTHORIZE_URL = "https://www.bungie.net/en/OAuth/Authorize";
const EVERVERSE_VENDOR_HASH = "3361454721";

function baseUrl(req) {
  const host = req.headers.host || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

function setTokenCookies(res, tokens) {
  const maxAge = tokens.refresh_expires_in || 7776000; // ~90 days fallback
  res.setHeader("Set-Cookie", [
    `gd_bungie_access=${tokens.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${tokens.expires_in}`,
    `gd_bungie_refresh=${tokens.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  ]);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

async function bungieFetch(path, accessToken, apiKey) {
  const res = await fetch(`https://www.bungie.net/Platform${path}`, {
    headers: {
      "X-API-Key": apiKey,
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function handleVendorLookup(req, res) {
  const apiKey = process.env.BUNGIE_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ error: "no_key" });
  }

  const cookies = parseCookies(req);
  const accessToken = cookies.gd_bungie_access;
  if (!accessToken) {
    return res.status(200).json({ error: "not_connected" });
  }

  try {
    const membershipsRes = await bungieFetch("/User/GetMembershipsForCurrentUser/", accessToken, apiKey);
    if (!membershipsRes.ok) {
      return res.status(membershipsRes.status).json({ error: "Failed to look up membership", upstream: membershipsRes.data });
    }
    const destinyMemberships = membershipsRes.data.Response?.destinyMemberships || [];
    const primary = destinyMemberships[0];
    if (!primary) {
      return res.status(404).json({ error: "No Destiny 2 membership found on this Bungie account" });
    }

    const profileRes = await bungieFetch(
      `/Destiny2/${primary.membershipType}/Profile/${primary.membershipId}/?components=200`,
      accessToken, apiKey
    );
    if (!profileRes.ok) {
      return res.status(profileRes.status).json({ error: "Failed to load profile", upstream: profileRes.data });
    }
    const characters = profileRes.data.Response?.characters?.data || {};
    const characterId = Object.keys(characters)[0];
    if (!characterId) {
      return res.status(404).json({ error: "No Destiny 2 characters found on this account" });
    }

    const vendorRes = await bungieFetch(
      `/Destiny2/${primary.membershipType}/Profile/${primary.membershipId}/Character/${characterId}/Vendors/${EVERVERSE_VENDOR_HASH}/?components=400,401,402`,
      accessToken, apiKey
    );
    if (!vendorRes.ok) {
      console.error("bungie: vendor call failed", vendorRes.data);
      return res.status(vendorRes.status).json({ error: "Failed to load Eververse vendor", upstream: vendorRes.data });
    }

    const sales = vendorRes.data.Response?.sales?.data || {};
    const items = Object.values(sales).map((sale) => ({
      itemHash: sale.itemHash,
      quantity: sale.quantity,
      costs: sale.costs,
    }));

    return res.status(200).json({ vendorRefreshDate: vendorRes.data.Response?.vendor?.data?.nextRefreshDate, items });
  } catch (err) {
    console.error("bungie: vendor request threw", err);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  const clientId = process.env.BUNGIE_CLIENT_ID;
  const clientSecret = process.env.BUNGIE_CLIENT_SECRET;
  const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const action = searchParams.get("action");

  // No action (or explicit "vendor") — the original bungie.js's only
  // behavior, kept as the default so existing callers with no ?action
  // param still work exactly as before.
  if (!action || action === "vendor") {
    return handleVendorLookup(req, res);
  }

  if (!clientId || !clientSecret) {
    return res.status(200).json({ error: "no_key" });
  }

  if (action === "authorize") {
    const authUrl = `${AUTHORIZE_URL}?client_id=${clientId}&response_type=code`;
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  if (action === "callback") {
    const code = searchParams.get("code");
    if (!code) {
      return res.status(400).json({ error: "Missing code from Bungie redirect" });
    }
    try {
      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("bungie: token exchange failed", tokens);
        return res.status(tokenRes.status).json({ error: "Token exchange failed", upstream: tokens });
      }
      setTokenCookies(res, tokens);
      res.writeHead(302, { Location: `${baseUrl(req)}/#/linking` });
      return res.end();
    } catch (err) {
      console.error("bungie: callback threw", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === "status") {
    const cookies = parseCookies(req);
    return res.status(200).json({ connected: Boolean(cookies.gd_bungie_access) });
  }

  if (action === "logout") {
    res.setHeader("Set-Cookie", [
      "gd_bungie_access=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      "gd_bungie_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    ]);
    return res.status(200).json({ loggedOut: true });
  }

  return res.status(400).json({ error: "Missing or invalid action parameter" });
}
