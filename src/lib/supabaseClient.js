// Supabase client — real, persistent accounts (Stage 5, pulled
// forward to get testers a working login/signup this weekend).
//
// Unlike every other API in this project, Supabase's client library
// is designed to be called directly from the browser with the "anon"
// key — that key is meant to be public (Row Level Security in the
// database is what actually protects people's data, not secrecy of
// this key). No server-side proxy needed here.
//
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY need the VITE_ prefix
// (unlike STEAM_API_KEY etc.) specifically so Vite exposes them to
// client-side code — everything else in this project deliberately
// avoided that prefix to keep secrets server-only, but this one key
// is designed to be public.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// flowType: "implicit" pinned explicitly — confirmed live (captured a
// real post-redirect URL while debugging a "signs in via Discord/
// Twitch but lands logged-out" report) that the OAuth redirect
// actually comes back as #access_token=...&refresh_token=... (the
// implicit-flow shape), not a ?code= query param. Leaving flowType on
// whatever supabase-js's own default happens to be risks a real,
// silent mismatch: if the client ever defaults to (or gets upgraded
// into) expecting PKCE's ?code= instead, it stops looking at the hash
// fragment entirely — the real, valid session token sits unused in
// the URL and the app just loads logged-out. Pinning this removes
// that whole class of risk regardless of what the library's default
// is now or changes to later.
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, { auth: { detectSessionInUrl: true, flowType: "implicit" } })
  : null;

// Both already meant to be public (see file header) — exported so
// lib/auth.js can hit Supabase's own REST endpoints directly (its own
// /auth/v1/settings, not the JS client) without duplicating them.
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
