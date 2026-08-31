// Real Crunchyroll linking — Crunchyroll has no public developer API
// or OAuth login at all, so this uses the person's own etp_rt session
// cookie (extracted from their own logged-in browser) the same way
// PSN linking uses an npsso token — never scraped/guessed, confirmed
// against HarshitKumar9030/crunchyroll-api's actual working
// implementation (api/pricing.js's handleCrunchyroll does the real
// token exchange server-side, since it needs to store long-lived
// tokens this app never wants to hand to the browser).

import { supabase } from "./supabaseClient";
import { API_BASE } from "./apiBase";

async function callCrunchyrollService(mode, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${API_BASE}/api/pricing?service=crunchyroll&mode=${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await res.json();
  if (!res.ok) throw new Error(responseBody?.error || `Crunchyroll ${mode} request failed`);
  return responseBody;
}

// Completes the real cookie-based sign-in — returns { titleCount }.
export async function linkCrunchyrollAccount(cookie) {
  return callCrunchyrollService("link", { cookie });
}

// Real watch history — { titles: ["Show Name", ...] }.
export async function fetchCrunchyrollLibrary() {
  return callCrunchyrollService("library");
}

export async function unlinkCrunchyroll() {
  return callCrunchyrollService("unlink");
}
