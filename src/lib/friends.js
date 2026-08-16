// Friends — real, mutual (request -> accept) connections between
// Lykodex users, found/added by a real per-account friend code (see
// profiles.friend_code in schema.sql). Never a one-way follow.

import { supabase } from "./supabaseClient";
import { getPublicProfiles } from "./publicProfiles";

export { getPublicProfiles };

export async function findUserByFriendCode(code) {
  const { data, error } = await supabase.rpc("find_user_by_friend_code", { p_code: code });
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchMyFriendCode(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("friend_code")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data.friend_code;
}

export async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from("friends")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  const friendIds = data.map((f) => f.friend_id);
  const profiles = await getPublicProfiles(friendIds);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return data.map((f) => ({ ...f, profile: profileById[f.friend_id] || null }));
}

export async function removeFriend(userId, friendId) {
  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("user_id", userId)
    .eq("friend_id", friendId);
  if (error) throw error;
}

export async function sendFriendRequest(senderId, receiverId) {
  const { error } = await supabase
    .from("friend_requests")
    .insert({ sender_id: senderId, receiver_id: receiverId });
  if (error) throw error;
}

// Both directions — "requests I sent" and "requests sent to me" —
// since accept/decline/withdraw actions differ depending on which
// side you're on.
export async function fetchFriendRequests(userId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set(data.flatMap((r) => [r.sender_id, r.receiver_id]))];
  const profiles = await getPublicProfiles(ids);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return data.map((r) => ({
    ...r,
    senderProfile: profileById[r.sender_id] || null,
    receiverProfile: profileById[r.receiver_id] || null,
  }));
}

export async function acceptFriendRequest(requestId) {
  const { error } = await supabase.rpc("accept_friend_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function declineFriendRequest(requestId) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

export async function withdrawFriendRequest(requestId) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
  if (error) throw error;
}
