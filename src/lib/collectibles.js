// Collectibles College — real personal physical inventory. Phase 1 of
// an approved design: pure CRUD, no external API dependency, since no
// general catalogue API exists for most of these item types (verified
// during scoping). Later phases add real lookups (Rebrickable for
// LEGO, Discogs for vinyl, IGDB for collector's editions) without
// needing a schema change — see schema.sql.

import { supabase } from "./supabaseClient";

export async function fetchCollectibles(userId) {
  const { data, error } = await supabase
    .from("collectible_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addCollectible(userId, entry) {
  const { error } = await supabase.from("collectible_entries").insert({
    user_id: userId,
    type: entry.type,
    title: entry.title,
    identifier: entry.identifier || null,
    package_state: entry.packageState,
    condition: entry.condition,
    qty: entry.qty || 1,
    price_paid: entry.pricePaid || null,
    currency: entry.currency || null,
    acquired_at: entry.acquiredAt || null,
    notes: entry.notes || null,
    is_wishlist: entry.isWishlist || false,
  });
  if (error) throw error;
}

export async function updateCollectible(entryId, patch) {
  const { error } = await supabase
    .from("collectible_entries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", entryId);
  if (error) throw error;
}

export async function removeCollectible(entryId) {
  const { error } = await supabase.from("collectible_entries").delete().eq("id", entryId);
  if (error) throw error;
}
