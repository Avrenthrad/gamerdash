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

// Same safe-field RPC pattern as find_user_by_friend_code — profiles'
// own SELECT policy is strictly self-only, so this needs the same
// SECURITY DEFINER escape hatch. Server-side enforces a 2-character
// minimum and a 10-result cap (see the migration), not just this call
// site, so this can't be used to enumerate every username in the app.
export async function searchUsersByUsername(query) {
  const { data, error } = await supabase.rpc("search_users_by_username", { p_query: query });
  if (error) throw error;
  return data || [];
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
  // Friendship rows are written symmetrically (one row per direction) —
  // remove both, so an unfriend doesn't leave the other side still able
  // to see/message this user as a friend.
  const { error } = await supabase
    .from("friends")
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    );
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

// ---------- Blocking — deliberately separate from unfriending ----------
// Blocking someone also tears down any existing friendship and any
// pending request between the two of you (see the block_user RPC),
// and stops them from sending you a new request afterward — none of
// which plain removeFriend() does.

export async function blockUser(blockedId) {
  const { error } = await supabase.rpc("block_user", { p_blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId, blockedId) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function fetchBlockedUsers(userId) {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("*")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = data.map((b) => b.blocked_id);
  const profiles = await getPublicProfiles(ids);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return data.map((b) => ({ ...b, profile: profileById[b.blocked_id] || null }));
}
