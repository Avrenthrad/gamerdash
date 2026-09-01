// Gaming Collection's Full Library row ratings — a real, persisted
// 1-10 rating per title. This is the first pass the user asked to
// keep intentionally minimal (a single number) with richer fields to
// follow later — but the rating itself is real and persists, not a
// UI mockup: submitting one sticks, and the cross-user average is a
// real aggregate (get_game_average_ratings RPC), never a fabricated
// number. Raw individual ratings stay strictly self-only (see
// schema.sql's game_ratings RLS) — the average RPC is the only way
// another user's rating ever contributes to anything you see.

import { supabase } from "./supabaseClient";

// { title -> rating } for every title this user has rated.
export async function fetchMyRatings(userId) {
  const { data, error } = await supabase
    .from("game_ratings")
    .select("title, rating")
    .eq("user_id", userId);
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) map.set(row.title, row.rating);
  return map;
}

export async function submitRating(userId, title, rating) {
  const { error } = await supabase
    .from("game_ratings")
    .upsert(
      { user_id: userId, title, rating, updated_at: new Date().toISOString() },
      { onConflict: "user_id,title" }
    );
  if (error) throw error;
}

export async function removeRating(userId, title) {
  const { error } = await supabase
    .from("game_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("title", title);
  if (error) throw error;
}

// Batched — one call for every title currently on screen rather than
// one round-trip per row. Returns { title -> { avg, count } }.
export async function fetchAverageRatings(titles) {
  if (!titles.length) return new Map();
  const { data, error } = await supabase.rpc("get_game_average_ratings", { p_titles: titles });
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    map.set(row.title, { avg: Number(row.avg_rating), count: Number(row.rating_count) });
  }
  return map;
}
