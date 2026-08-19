// Marketplace — real user-to-user listings, shared by TCG and
// Collectibles (see MarketplaceSection.jsx). One table
// (marketplace_listings) with a category column keeps this from being
// duplicated per College; each College's UI only ever queries its own
// category, so they stay honestly separate to the person using them.
//
// No in-app payments, chat, or offer/negotiation system — v1 is a
// real listing board. "Contact Seller" reuses the existing Lykodex
// friend-request system (lib/friends.js) as the honest way a buyer
// and seller actually get in touch, rather than inventing a second
// messaging system for this.

import { supabase } from "./supabaseClient";
import { getPublicProfiles } from "./publicProfiles";
import { sendFriendRequest } from "./friends";

export async function fetchListings(category, { excludeUserId } = {}) {
  let query = supabase
    .from("marketplace_listings")
    .select("*")
    .eq("category", category)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (excludeUserId) query = query.neq("user_id", excludeUserId);

  const { data, error } = await query;
  if (error) throw error;

  const sellerIds = [...new Set((data || []).map((l) => l.user_id))];
  const profiles = await getPublicProfiles(sellerIds);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return (data || []).map((l) => ({ ...l, seller: profileById[l.user_id] || null }));
}

export async function fetchMyListings(userId, category) {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("user_id", userId)
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createListing(userId, listing) {
  const { error } = await supabase.from("marketplace_listings").insert({
    user_id: userId,
    category: listing.category,
    title: listing.title,
    description: listing.description || null,
    price: listing.price,
    currency: listing.currency || "USD",
    condition: listing.condition || null,
    photo_url: listing.photoUrl || null,
  });
  if (error) throw error;
}

export async function updateListingStatus(listingId, status) {
  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw error;
}

export async function deleteListing(listingId) {
  const { error } = await supabase.from("marketplace_listings").delete().eq("id", listingId);
  if (error) throw error;
}

// Same real Supabase Storage upload pattern as avatars/wallpapers/
// guild-media (see AccountSettingsPage.jsx / GuildsPage.jsx) — a real
// public URL, not a throwaway blob: one.
export async function uploadListingPhoto(userId, file) {
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const mimeExt = file.type?.split("/")?.[1];
  const ext = (nameExt || mimeExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${Date.now()}.${ext || "jpg"}`;

  const { error: uploadError } = await supabase.storage
    .from("marketplace-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("marketplace-photos").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// Thin wrapper over the real friend-request system — 23505 is
// Postgres's unique-violation code, thrown here by friend_requests'
// own unique(sender_id, receiver_id) constraint when a request is
// already pending, turned into a clean status instead of a raw DB
// error bubbling up to the UI.
export async function contactSeller(buyerId, sellerId) {
  try {
    await sendFriendRequest(buyerId, sellerId);
    return "sent";
  } catch (err) {
    if (err.code === "23505") return "already_sent";
    throw err;
  }
}
