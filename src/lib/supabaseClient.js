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

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
