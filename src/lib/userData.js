// Real, persistent profile + wishlist data via Supabase — replaces
// the plain React state everything used to live in. See
// supabase/schema.sql for the table definitions.

import { supabase } from "./supabaseClient";

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, fields) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function fetchWishlist(userId) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, title: row.title, type: "game", addedAt: row.added_at }));
}

export async function insertWishlistItem(userId, title) {
  const { error } = await supabase
    .from("wishlist_items")
    .upsert({ user_id: userId, title }, { onConflict: "user_id,title", ignoreDuplicates: true });
  if (error) throw error;
}

export async function deleteWishlistItem(userId, title) {
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .ilike("title", title);
  if (error) throw error;
}
