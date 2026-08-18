// Reads the data the separate presence bot writes (see /discord-bot).
// This is the ONE place in the main app that queries current_activity
// and platform_playtime — everything here is a plain read using the
// normal anon-key client, protected by the "any signed-in user can
// read" RLS policies set up in schema.sql (the bot is what writes to
// these tables, using its own separate service_role key, never this one).

import { supabase } from "./supabaseClient";

export async function fetchCurrentActivity(userId) {
  const { data, error } = await supabase
    .from("current_activity")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data; // { platform, game_name, updated_at } or null if never set
}

export async function fetchPlatformPlaytime(userId) {
  const { data, error } = await supabase
    .from("platform_playtime")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data || []; // [{ platform, game_name, total_minutes }, ...]
}

// Batched versions for showing REAL Lykodex friends' cross-platform
// activity (see FriendSection.jsx) — one query for the whole friend
// list instead of one per friend.
//
// Deliberately scoped to xbox/playstation only, excluding "steam" and
// "unknown". Steam already has its own real, richer, live presence +
// friends API (see lib/steam.js / lib/friendsData.js) shown separately
// — surfacing the bot's lower-fidelity Discord-sourced "steam" reading
// too would just double-report the same real activity through a worse
// source, not add new information. Xbox/PlayStation have no other real
// source at all, which is the actual point of this bot.
const TRACKED_PLATFORMS = ["xbox", "playstation"];

export async function fetchCurrentActivityForUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};
  const { data, error } = await supabase
    .from("current_activity")
    .select("*")
    .in("user_id", userIds)
    .in("platform", TRACKED_PLATFORMS);
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.user_id, row]));
}

export async function fetchPlatformPlaytimeForUsers(userIds) {
  if (!userIds || userIds.length === 0) return {};
  const { data, error } = await supabase
    .from("platform_playtime")
    .select("*")
    .in("user_id", userIds)
    .in("platform", TRACKED_PLATFORMS);
  if (error) throw error;

  const byUser = {};
  for (const row of data || []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = { xboxHours: 0, playstationHours: 0 };
    if (row.platform === "xbox") byUser[row.user_id].xboxHours += row.total_minutes / 60;
    if (row.platform === "playstation") byUser[row.user_id].playstationHours += row.total_minutes / 60;
  }
  for (const userId in byUser) {
    byUser[userId].xboxHours = Math.round(byUser[userId].xboxHours);
    byUser[userId].playstationHours = Math.round(byUser[userId].playstationHours);
  }
  return byUser;
}
