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
  fab_card_added: "added a card to their Flesh and Blood collection:",
  pokemon_card_added: "added a card to their Pokémon collection:",
  joined_guild: "joined the guild",
  guild_post_commented: "commented on a post:",
  guild_comment_replied: "replied to a comment:",
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

// ---------- Customization: logo, banner, description ----------

export async function updateGuildProfile(guildId, { logoUrl, bannerUrl, description } = {}) {
  const updates = {};
  if (logoUrl !== undefined) updates.logo_url = logoUrl;
  if (bannerUrl !== undefined) updates.banner_url = bannerUrl;
  if (description !== undefined) updates.description = description;
  const { error } = await supabase.from("guilds").update(updates).eq("id", guildId);
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
  return attachProfiles(data || []);
}

// Batch-enriches activity rows with the real profile (avatar, name)
// of whoever did the thing — same getPublicProfiles pattern used
// everywhere else a list of user_ids needs real names/avatars.
async function attachProfiles(rows) {
  if (rows.length === 0) return rows;
  const profiles = await getPublicProfiles([...new Set(rows.map((r) => r.user_id))]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: profileById[r.user_id] || null }));
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
  return attachProfiles(data || []);
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

// For events that already know exactly which one guild they belong to
// (a post/comment in a specific guild) — inserts a single real row for
// that guild only, rather than logActivityForUser's fan-out-to-every-
// membership behavior, which would be wrong here: a person commenting
// in one guild shouldn't show up as activity in every OTHER guild they
// happen to also belong to.
export async function logActivityForGuild(guildId, userId, eventType, eventData) {
  try {
    const { error } = await supabase.from("guild_activity").insert({
      guild_id: guildId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    });
    if (error) throw error;
  } catch (err) {
    console.error("Failed to log guild activity:", err);
  }
}

// ---------- Posts (the real Reddit-like feed) ----------
// Score is summed client-side from a single batched vote fetch rather
// than a trigger/materialized column — guild feeds are small enough
// that this is simpler and just as honest.

export async function fetchGuildPosts(guildId, viewerId) {
  const { data: posts, error } = await supabase
    .from("guild_posts")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  const [profiles, votesResult, commentsResult] = await Promise.all([
    getPublicProfiles([...new Set(posts.map((p) => p.user_id))]),
    supabase.from("guild_post_votes").select("post_id, user_id, value").in("post_id", postIds),
    supabase.from("guild_post_comments").select("post_id").in("post_id", postIds),
  ]);
  if (votesResult.error) throw votesResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const scoreByPost = {};
  const myVoteByPost = {};
  (votesResult.data || []).forEach((v) => {
    scoreByPost[v.post_id] = (scoreByPost[v.post_id] || 0) + v.value;
    if (v.user_id === viewerId) myVoteByPost[v.post_id] = v.value;
  });

  const commentCountByPost = {};
  (commentsResult.data || []).forEach((c) => {
    commentCountByPost[c.post_id] = (commentCountByPost[c.post_id] || 0) + 1;
  });

  return posts.map((p) => ({
    ...p,
    author: profileById[p.user_id] || null,
    score: scoreByPost[p.id] || 0,
    myVote: myVoteByPost[p.id] || 0,
    commentCount: commentCountByPost[p.id] || 0,
  }));
}

export async function createGuildPost(userId, guildId, { title, body, imageUrl }) {
  const { error } = await supabase.from("guild_posts").insert({
    guild_id: guildId,
    user_id: userId,
    title,
    body: body || null,
    image_url: imageUrl || null,
  });
  if (error) throw error;
}

export async function deleteGuildPost(postId) {
  const { error } = await supabase.from("guild_posts").delete().eq("id", postId);
  if (error) throw error;
}

// Clicking the same direction again removes the vote (toggle off);
// clicking the opposite direction flips it — never a separate "undo"
// control, matches how every real upvote/downvote UI behaves.
export async function voteOnPost(userId, postId, value, currentVote) {
  if (currentVote === value) {
    const { error } = await supabase
      .from("guild_post_votes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
    return 0;
  }
  const { error } = await supabase
    .from("guild_post_votes")
    .upsert({ post_id: postId, user_id: userId, value }, { onConflict: "post_id,user_id" });
  if (error) throw error;
  return value;
}

export async function fetchPostComments(postId) {
  const { data, error } = await supabase
    .from("guild_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const profiles = await getPublicProfiles([...new Set((data || []).map((c) => c.user_id))]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return (data || []).map((c) => ({ ...c, author: profileById[c.user_id] || null }));
}

// One level of threading — a reply passes the top-level comment it's
// replying to as parentCommentId; a reply itself can't be replied to
// (enforced in the UI, not the DB, same as this app's other real-but-
// bounded depth decisions). Logs to the post's own guild only, via
// logActivityForGuild, not a fan-out to every guild the commenter
// happens to belong to.
export async function addPostComment(userId, postId, guildId, body, parentCommentId = null) {
  const { error } = await supabase
    .from("guild_post_comments")
    .insert({ post_id: postId, user_id: userId, body, parent_comment_id: parentCommentId });
  if (error) throw error;
  logActivityForGuild(guildId, userId, parentCommentId ? "guild_comment_replied" : "guild_post_commented", { title: body.slice(0, 80) });
}

export async function deletePostComment(commentId) {
  const { error } = await supabase.from("guild_post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

// Same real Supabase Storage upload pattern as everywhere else in
// this app (avatars/wallpapers/guild-media) — folder-scoped to the
// uploader, since a post image belongs to whoever posted it.
export async function uploadPostImage(userId, file) {
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const mimeExt = file.type?.split("/")?.[1];
  const ext = (nameExt || mimeExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${Date.now()}.${ext || "jpg"}`;

  const { error: uploadError } = await supabase.storage
    .from("guild-post-images")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("guild-post-images").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
