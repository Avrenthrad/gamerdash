// Backlog / To Be Played list.
//
// Every data point here is real except one: hours_estimate is
// explicitly self-reported (see schema.sql for why — no legitimate
// public API exists for "how long does this game take to beat").
// Everything else — Metacritic score, Steam review summary, release
// date, achievement counts — comes from Steam's real API, the same
// functions already used for wishlist cards elsewhere in this app.

import { supabase } from "./supabaseClient";
import { resolveGameName, fetchAchievementSchema, fetchAchievements } from "./steam";

// Same 4-state model every competitor backlog tracker uses
// (Backloggd, Grouvee, Playlogged) — real research, not guessed.
export const STATUSES = ["backlog", "playing", "completed", "dropped"];
export const STATUS_LABELS = {
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  dropped: "Dropped",
};

export async function fetchBacklog(userId) {
  const { data, error } = await supabase
    .from("backlog_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addToBacklog(userId, title, steamAppid = null) {
  const { error } = await supabase
    .from("backlog_items")
    .insert({ user_id: userId, title, steam_appid: steamAppid ? String(steamAppid) : null });
  if (error) throw error;
}

export async function removeFromBacklog(itemId) {
  const { error } = await supabase.from("backlog_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function setHoursEstimate(itemId, hours) {
  const { error } = await supabase
    .from("backlog_items")
    .update({ hours_estimate: hours === "" || hours === null ? null : Number(hours) })
    .eq("id", itemId);
  if (error) throw error;
}

export async function setBacklogStatus(itemId, status) {
  if (!STATUSES.includes(status)) throw new Error(`Invalid backlog status: ${status}`);
  const { error } = await supabase.from("backlog_items").update({ status }).eq("id", itemId);
  if (error) throw error;
}

// Enriches a raw backlog row with real metadata — only possible for
// items that have a steam_appid (set at add time from search/import
// results). Items added without a resolvable Steam match just show
// their title and self-reported hours, nothing more — an honest gap
// rather than guessed data.
export async function enrichBacklogItem(item, linkedSteamId) {
  if (!item.steam_appid) {
    return { ...item, thumb: null, releaseDate: null, metacriticScore: null, totalAchievements: null, unlockedAchievements: null };
  }

  try {
    const info = await resolveGameName(item.steam_appid);
    let totalAchievements = null;
    let unlockedAchievements = null;

    try {
      const schema = await fetchAchievementSchema(item.steam_appid);
      totalAchievements = schema.length;
      if (linkedSteamId && schema.length > 0) {
        const achievements = await fetchAchievements(linkedSteamId, item.steam_appid);
        unlockedAchievements = achievements.filter((a) => a.achieved === 1).length;
      }
    } catch {
      // This game might not have achievements at all — leave as null, not an error.
    }

    return {
      ...item,
      thumb: info.thumb || null,
      releaseDate: info.releaseDate || null,
      metacriticScore: info.metacriticScore ?? null,
      totalAchievements,
      unlockedAchievements,
    };
  } catch (err) {
    console.error(`Failed to enrich backlog item "${item.title}":`, err);
    return { ...item, thumb: null, releaseDate: null, metacriticScore: null, totalAchievements: null, unlockedAchievements: null };
  }
}
