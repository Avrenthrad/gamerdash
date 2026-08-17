// Xbox/PlayStation manual achievement/trophy tracker — see
// platform_achievements in schema.sql for why this exists and why
// game_name is free text rather than a foreign key. Steam achievements
// never go through here; they're a live view of lib/steam.js's real
// API data (see AchievementsPage.jsx).

import { supabase } from "./supabaseClient";

export async function fetchPlatformAchievements(userId, platform) {
  const { data, error } = await supabase
    .from("platform_achievements")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .order("game_name", { ascending: true })
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addPlatformAchievement(userId, platform, { gameName, achievementName, description }) {
  const { error } = await supabase.from("platform_achievements").insert({
    user_id: userId,
    platform,
    game_name: gameName,
    achievement_name: achievementName,
    description: description || null,
  });
  if (error) throw error;
}

export async function toggleAchievementUnlocked(achievementId, unlocked) {
  const { error } = await supabase
    .from("platform_achievements")
    .update({ unlocked, unlocked_at: unlocked ? new Date().toISOString() : null })
    .eq("id", achievementId);
  if (error) throw error;
}

export async function deletePlatformAchievement(achievementId) {
  const { error } = await supabase.from("platform_achievements").delete().eq("id", achievementId);
  if (error) throw error;
}
