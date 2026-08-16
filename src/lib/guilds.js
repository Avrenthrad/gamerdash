// Guilds — real social groups of Lykodex users. Not the same as the 5
// top-level Colleges (Gaming/TCG/Entertainment/Collectibles/Tabletop)
// — a Guild is a small crew that cuts across all of them.
//
// The activity feed is deliberately built from real, already-tracked
// Lykodex data (see logGuildActivity below) — never invented stats.
// See schema.sql for the full reasoning.

import { supabase } from "./supabaseClient";
import { getPublicProfiles } from "./publicProfiles";

const EVENT_LABELS = {
  achievement_unlocked: "unlocked an achievement in",
  gd_score_milestone: "hit a new GD Score high",
  backlog_status_change: "updated their backlog:",
  wishlist_added: "added to their wishlist:",
  mtg_card_added: "added a card to their MTG collection:",
  joined_guild: "joined the guild",
};

// Shared with the header notification bell so both surfaces describe
// the same real activity rows identically.
export function describeActivity(entry) {
  const label = EVENT_LABELS[entry.event_type] || entry.event_type;
  const detail = entry.event_data?.title || entry.event_data?.name || "";
  return `${label}${detail ? ` ${detail}` : ""}`;
}

export async function fetchGuilds() {
  const { data, error } = await supabase
    .from("guilds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createGuild(userId, name, isPrivate = false) {
  const { data, error } = await supabase
    .from("guilds")
    // code is generated server-side by the on_guild_created trigger —
    // never set client-side.
    .insert({ name, created_by: userId, is_private: isPrivate })
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

// Real, immediate join via a guild's own unique code — same trust
// model as a Discord invite link. Goes through a SECURITY DEFINER
// function since it has to work for private guilds too (which a
// plain client-side insert into guild_members can't reach — see
// schema.sql for why the membership INSERT policy was tightened).
export async function joinGuildByCode(code) {
  const { data, error } = await supabase.rpc("join_guild_by_code", { p_code: code });
  if (error) throw error;
  return data;
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

// Same as fetchGuildMembers but enriched with real names/avatars for
// display — used by the Guild Settings roster.
export async function fetchGuildMembersWithProfiles(guildId) {
  const members = await fetchGuildMembers(guildId);
  const profiles = await getPublicProfiles(members.map((m) => m.user_id));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return members.map((m) => ({ ...m, profile: profileById[m.user_id] || null }));
}

// ---------- Privacy: browsable/request-to-join ----------

export async function updateGuildPrivacy(guildId, isPrivate) {
  const { error } = await supabase.from("guilds").update({ is_private: isPrivate }).eq("id", guildId);
  if (error) throw error;
}

export async function requestToJoinGuild(guildId, userId) {
  const { error } = await supabase.from("guild_join_requests").insert({ guild_id: guildId, user_id: userId });
  if (error) throw error;
}

export async function withdrawJoinRequest(requestId) {
  const { error } = await supabase.from("guild_join_requests").delete().eq("id", requestId);
  if (error) throw error;
}

export async function fetchMyJoinRequest(guildId, userId) {
  const { data, error } = await supabase
    .from("guild_join_requests")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Owner-only view — every pending request for a guild they created,
// enriched with the requester's real name/avatar.
export async function fetchJoinRequestsForGuild(guildId) {
  const { data, error } = await supabase
    .from("guild_join_requests")
    .select("*")
    .eq("guild_id", guildId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const profiles = await getPublicProfiles(data.map((r) => r.user_id));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return data.map((r) => ({ ...r, profile: profileById[r.user_id] || null }));
}

// Approve/decline both go through the same SECURITY DEFINER function
// since approving also has to insert a membership row for someone who
// isn't the caller — see respond_to_join_request() in schema.sql.
export async function respondToJoinRequest(requestId, approve) {
  const { error } = await supabase.rpc("respond_to_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}

// ---------- Invites ----------

export async function inviteToGuild(guildId, invitedUserId, invitedBy) {
  const { error } = await supabase
    .from("guild_invites")
    .insert({ guild_id: guildId, invited_user_id: invitedUserId, invited_by: invitedBy });
  if (error) throw error;
}

export async function fetchMyGuildInvites(userId) {
  const { data, error } = await supabase
    .from("guild_invites")
    .select("*, guilds(name, code, is_private)")
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Two plain client-side steps rather than a function: flip the invite
// to accepted, then insert the membership row — the second insert is
// self-only (auth.uid() = invited user), already covered by the
// tightened guild_members INSERT policy once the first step lands.
export async function acceptGuildInvite(invite) {
  const { error: updateError } = await supabase
    .from("guild_invites")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (updateError) throw updateError;
  await joinGuild(invite.guild_id, invite.invited_user_id);
}

export async function declineGuildInvite(inviteId) {
  const { error } = await supabase
    .from("guild_invites")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function revokeGuildInvite(inviteId) {
  const { error } = await supabase.from("guild_invites").delete().eq("id", inviteId);
  if (error) throw error;
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

// Powers the header notification bell — real activity across every
// Guild the user is actually a member of (their own actions plus
// their guildmates'), never invented counts or placeholder rows.
// Returns [] for someone in no guilds, which the bell renders as a
// genuine empty state rather than hiding itself.
export async function fetchRecentActivityForUser(userId, limit = 10) {
  const { data: memberships, error: memberError } = await supabase
    .from("guild_members")
    .select("guild_id")
    .eq("user_id", userId);
  if (memberError) throw memberError;

  const guildIds = (memberships || []).map((m) => m.guild_id);
  if (guildIds.length === 0) return [];

  const { data, error } = await supabase
    .from("guild_activity")
    .select("*, guilds(name)")
    .in("guild_id", guildIds)
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
