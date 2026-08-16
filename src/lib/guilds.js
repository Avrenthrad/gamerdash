// Guilds — real social groups of Lykodex users. Not the same as the 5
// top-level Colleges (Gaming/TCG/Entertainment/Collectibles/Tabletop)
// — a Guild is a small crew that cuts across all of them.
//
// The activity feed is deliberately built from real, already-tracked
// Lykodex data (see logGuildActivity below) — never invented stats.
// See schema.sql for the full reasoning.

import { supabase } from "./supabaseClient";

export async function fetchGuilds() {
  const { data, error } = await supabase
    .from("guilds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createGuild(userId, name) {
  const { data, error } = await supabase
    .from("guilds")
    .insert({ name, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  // Creating a guild doesn't automatically make you a member at the
  // database level (a separate real membership row is still needed,
  // same as anyone else joining) — keeps membership logic in one place.
  await joinGuild(data.id, userId);
  return data;
}

export async function joinGuild(guildId, userId) {
  const { error } = await supabase.from("guild_members").insert({ guild_id: guildId, user_id: userId });
  if (error) throw error;
  await logGuildActivity(guildId, userId, "joined_guild", {});
}

export async function leaveGuild(guildId, userId) {
  const { error } = await supabase
    .from("guild_members")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchGuildMembers(guildId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchMyGuilds(userId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("guild_id, guilds(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => row.guilds).filter(Boolean);
}

export async function fetchGuildActivity(guildId, limit = 30) {
  const { data, error } = await supabase
    .from("guild_activity")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// The one function the rest of the app actually calls when something
// real happens (a backlog status change, a wishlist add, etc.) — logs
// it to every guild the user is currently in. Silently does nothing
// if the user isn't in any guild, and never throws upward — a failed
// activity-feed write should never block the real action that
// triggered it (e.g. don't fail a wishlist add just because the
// social feed write had a hiccup).
export async function logGuildActivity(userIdOrGuildId, maybeUserId, eventType, eventData) {
  // Supports two call shapes: logGuildActivity(guildId, userId, type, data)
  // for a single known guild (e.g. right after joining), or
  // logGuildActivityForUser(userId, type, data) to fan out to every
  // guild the user is in — see the wrapper below for the common case.
  try {
    const { error } = await supabase
      .from("guild_activity")
      .insert({ guild_id: userIdOrGuildId, user_id: maybeUserId, event_type: eventType, event_data: eventData });
    if (error) throw error;
  } catch (err) {
    console.error("Failed to log guild activity:", err);
  }
}

// The real integration point — call this from anywhere a genuine
// event happens (backlog completed, wishlist added, achievement
// unlocked, etc.). Fans out to every guild the user belongs to.
// Deliberately fire-and-forget from the caller's perspective — never
// awaited in a way that could block or fail the real user action.
export async function logActivityForUser(userId, eventType, eventData) {
  try {
    const { data: memberships, error } = await supabase
      .from("guild_members")
      .select("guild_id")
      .eq("user_id", userId);
    if (error) throw error;
    if (!memberships || memberships.length === 0) return; // not in any guild — nothing to do

    await Promise.all(
      memberships.map((m) =>
        supabase.from("guild_activity").insert({
          guild_id: m.guild_id,
          user_id: userId,
          event_type: eventType,
          event_data: eventData,
        })
      )
    );
  } catch (err) {
    console.error("Failed to log guild activity for user:", err);
  }
}
