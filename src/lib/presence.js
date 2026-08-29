// Real in-app "online now" presence via Supabase Realtime Presence — a
// single shared channel every signed-in client joins, keyed by
// user_id, so any component can know who else is currently in
// Lykodex right now. Deliberately unrelated to Steam presence
// (SteamPresenceCard/steamPresence.js) — that reflects a linked game
// platform's status, not whether someone actually has Lykodex open.

import { supabase } from "./supabaseClient";

const CHANNEL_NAME = "lykodex-presence";

// Subscribes `userId` to the shared presence channel and calls
// onChange(Set<userId>) every time the set of online users changes
// (initial sync, someone joining, someone leaving). Returns an
// unsubscribe function — call it on sign-out/unmount so the client
// leaves cleanly instead of waiting for Supabase to time the socket
// out.
export function subscribeToPresence(userId, onChange) {
  if (!supabase || !userId) return () => {};

  const channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  function emit() {
    const state = channel.presenceState();
    onChange(new Set(Object.keys(state)));
  }

  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ online_at: new Date().toISOString() });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

// Sorts a list online-first (alphabetically by display name among
// themselves), then everyone else (also alphabetically). `getUserId`
// and `getDisplayName` are accessors so this works against both the
// friends list (`f.friend_id` / `f.profile`) and the guild member
// roster (`m.user_id` / `m.profile`) shapes without either one having
// to be reshaped to match the other.
export function sortOnlineFirst(items, onlineUserIds, getUserId, getDisplayName) {
  return [...items].sort((a, b) => {
    const aOnline = onlineUserIds.has(getUserId(a));
    const bOnline = onlineUserIds.has(getUserId(b));
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}
