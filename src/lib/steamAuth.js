// Real "Sign in through Steam" via Steam's OpenID 2.0 provider — the
// only account-linking mechanism Valve actually offers. There's no
// OAuth2/app-registration option for proving someone owns a Steam
// account the way there is for Discord/Twitch/Xbox — the existing
// STEAM_API_KEY (see api/steam.js) authenticates OUR app to Steam's
// data endpoints, it has nothing to do with a person proving they own
// a given account. No key/secret/app registration is needed for this
// sign-in itself, unlike every other platform linked from this app.
//
// Replaces the old "paste your SteamID64/profile URL and we trust it"
// flow — real proof of ownership instead, verified server-side
// (api/steam.js's verifyOpenId mode) since the redirect's query
// params are trivially forgeable client-side on their own.
//
// Web-only for now: Steam's OpenID realm/return_to must be a real
// http(s) URL it can validate — unlike Xbox/Discord's OAuth2
// redirect_uri, there's no app-registration step anywhere to register
// a custom lykodex:// scheme as an allowed destination, so packaged-
// app support would need a real hosted bounce-back page and isn't
// built yet.

import { API_BASE } from "./apiBase";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

// Steam appends its own openid.* response params to whatever
// return_to URL you give it via a real redirect (not a hash) — using
// the app's own root, same as Xbox's web redirect_uri, since this is
// a hash-routed SPA with no server-side rewrite rules for other paths.
function steamReturnTo() {
  return `${window.location.origin}/`;
}

export function getSteamSignInUrl() {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": steamReturnTo(),
    "openid.realm": window.location.origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export function startSteamSignIn() {
  window.location.href = getSteamSignInUrl();
}

// Checks the current URL for a Steam OpenID callback (the real
// ?openid.* params Steam appended to the return_to above) — called
// once at app boot, same shape as xboxOAuth.js's
// consumeXboxOAuthCallback. Strips the query string off either way so
// a page refresh never tries to re-verify an already-used response
// (Steam would reject the replay anyway; this just avoids trying).
export function consumeSteamOpenIdCallback() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("openid.mode")) return null;

  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  return Object.fromEntries(params.entries());
}

// Server-side verification (api/steam.js's verifyOpenId mode) — the
// redirect alone proves nothing (any client could forge those query
// params), so this re-posts them to Steam itself and only trusts the
// SteamID64 if Steam confirms them genuine. No caller auth needed for
// this specific call since it doesn't write anything itself —
// AppContext.jsx applies the resulting steamId the same way the old
// manual entry did (setLinkedSteamId, via the existing debounced
// profile write).
export async function verifySteamOpenIdCallback(openidParams) {
  const query = new URLSearchParams({ ...openidParams, mode: "verifyOpenId" });
  const res = await fetch(`${API_BASE}/api/steam?${query.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Steam sign-in verification failed");
  return data.steamId;
}
