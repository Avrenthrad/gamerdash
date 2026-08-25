// Direct Messages — real 1:1 messaging between real, mutual friends
// only (see lib/friends.js / the `friends` table). No group chat, no
// messaging strangers — enforced server-side by direct_messages' own
// insert RLS policy (a real friendship must exist), not just here.
//
// Deliberately never logged via logActivityForUser/logActivityForGuild
// — a private message must never be broadcast into any Guild feed or
// the notifications bell.

import { supabase } from "./supabaseClient";
import { fetchFriends } from "./friends";

// Mutual read receipts — see profiles.read_receipts_enabled. The
// caller combines this with their OWN setting (already held in
// AppContext, not fetched here) to decide whether to actually render
// a read indicator: both sides have to have it on.
export async function fetchReadReceiptsEnabled(friendId) {
  const { data, error } = await supabase.rpc("get_read_receipts_settings", { p_ids: [friendId] });
  if (error) throw error;
  return data?.[0]?.read_receipts_enabled ?? true;
}

export async function fetchThread(userId, friendId) {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendMessage(senderId, receiverId, body) {
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markThreadRead(userId, friendId) {
  const { error } = await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", userId)
    .eq("sender_id", friendId)
    .is("read_at", null);
  if (error) throw error;
}

export async function fetchUnreadCount(userId) {
  const { count, error } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

// Every real friend is a valid messaging target, not just ones with
// existing history — otherwise there'd be no way to send a genuine
// first message. Built from two real sources merged client-side (zero
// N+1): the friends list itself, plus one flat message query reduced
// into a last-message/unread-count map per friend.
export async function fetchInboxList(userId) {
  const [friends, messages] = await Promise.all([
    fetchFriends(userId),
    supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      }),
  ]);

  const byOtherId = new Map();
  for (const m of messages) {
    const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    const entry = byOtherId.get(otherId) || { lastMessage: null, unreadCount: 0 };
    if (!entry.lastMessage) entry.lastMessage = m; // newest-first scan — first hit per otherId wins
    if (m.receiver_id === userId && !m.read_at) entry.unreadCount += 1;
    byOtherId.set(otherId, entry);
  }

  return friends
    .map((f) => {
      const entry = byOtherId.get(f.friend_id) || { lastMessage: null, unreadCount: 0 };
      return { ...f, lastMessage: entry.lastMessage, unreadCount: entry.unreadCount };
    })
    .sort((a, b) => (b.lastMessage?.created_at || "").localeCompare(a.lastMessage?.created_at || ""));
}
