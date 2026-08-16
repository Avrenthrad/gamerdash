// Entertainment College — real movie/TV tracking via TMDB. See
// lib/tmdb.js for the source integration and schema.sql for the
// table shape (already accommodates anime/books for later).

import { supabase } from "./supabaseClient";

export async function fetchEntertainmentEntries(userId) {
  const { data, error } = await supabase
    .from("entertainment_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addEntertainmentEntry(userId, result) {
  const source = result.mediaKind === "anime" ? "anilist" : result.mediaKind === "book" ? "open_library" : "tmdb";
  const { error } = await supabase.from("entertainment_entries").insert({
    user_id: userId,
    media_kind: result.mediaKind,
    source,
    source_item_id: String(result.id),
    title: result.title,
    cover_url: result.posterUrl,
  });
  if (error) throw error;
}

export async function updateEntertainmentStatus(entryId, status) {
  const { error } = await supabase
    .from("entertainment_entries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) throw error;
}

export async function removeEntertainmentEntry(entryId) {
  const { error } = await supabase.from("entertainment_entries").delete().eq("id", entryId);
  if (error) throw error;
}
