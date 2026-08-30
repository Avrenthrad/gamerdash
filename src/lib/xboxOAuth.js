// Real Xbox Live sign-in — Microsoft OAuth2 (login.live.com) -> Xbox
// Live user token -> XSTS token, confirmed against OpenXbox/xbox-
// webapi-python's actual working implementation (not guessed). The
// 3-step exchange itself happens server-side (api/pricing.js's
// handleXbox) since it needs a client secret and stores long-lived
// tokens this app never wants to hand to the browser — this file only
// builds the consent URL and calls that proxy.
//
// Web-only for now: the redirect-based OAuth flow needs a real
// same-window browser redirect back to this app, which packaged
// (Tauri/Capacitor) builds can't do the way a normal web tab can (see
// lib/auth.js's signInWithOAuth comment for the same constraint on
// Discord/Twitch) — packaged-app support isn't built yet.

import { supabase } from "./supabaseClient";
import { API_BASE } from "./apiBase";

const XBOX_OAUTH_STATE = "xbox-link";
const XBOX_SCOPES = "Xboxlive.signin Xboxlive.offline_access";

// The redirect_uri Microsoft sends the user back to must exactly match
// what's registered in the Azure app AND what's sent in the token
// exchange - using the app's own root (no path) since this is a
// hash-routed SPA with no server-side rewrite rules for other paths.
export function xboxRedirectUri() {
  return `${window.location.origin}/`;
}

export function getXboxSignInUrl() {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    approval_prompt: "auto",
    scope: XBOX_SCOPES,
    redirect_uri: xboxRedirectUri(),
    state: XBOX_OAUTH_STATE,
  });
  return `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;
}

// Checks the current URL for a Microsoft OAuth callback (?code=...&
// state=xbox-link) — called once at app boot (see AppContext.jsx).
// Cleans the query string off the URL either way so a page refresh
// doesn't try to redeem an already-used code.
export function consumeXboxOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (state !== XBOX_OAUTH_STATE) return null;

  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  if (error) return { error: params.get("error_description") || error };
  if (!code) return null;
  return { code };
}

async function callXboxService(mode, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${API_BASE}/api/pricing?service=xbox&mode=${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json();
  if (!res.ok) throw new Error(responseBody?.error || `Xbox ${mode} request failed`);
  return responseBody;
}

// Completes the real OAuth exchange for a freshly-received code —
// returns { gamertag, gamerscore }, both real.
export async function completeXboxLink(code) {
  return callXboxService("link", { code, redirectUri: xboxRedirectUri() });
}

// Pulls the current real Gamerscore for an already-linked account —
// this is what Refresh in GameMasterySection calls.
export async function fetchLiveGamerscore() {
  return callXboxService("gamerscore");
}

export async function unlinkXbox() {
  return callXboxService("unlink");
}

// Real online/offline state + whatever title is actively being played
// right now (if any) — { online: boolean, playing: { name,
// richPresence } | null }.
export async function fetchLiveXboxPresence() {
  return callXboxService("presence");
}
