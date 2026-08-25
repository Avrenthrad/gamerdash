// Orchestrates real Steam achievement data for Game Services —
// combines three separate Steam endpoints (owned games, per-game
// unlocked achievements, achievement schema, global rarity) into one
// clean "recently unlocked" feed.
//
// Approach: check the person's most-played owned games for anything
// unlocked recently, rather than trying to scan their entire library
// (could be hundreds of games) — keeps this fast and within a
// reasonable number of API calls.

import { fetchOwnedGames, fetchAchievements, fetchAchievementSchema, fetchGlobalAchievementPercentages } from "./steam";
import { supabase } from "./supabaseClient";
import { logActivityForUser } from "./guilds";

const GAMES_TO_CHECK = 8;

// Returns the most recently unlocked achievements across a person's
// most-played games, enriched with real display names, descriptions,
// icons, and global unlock rarity.
export async function fetchRecentAchievements(steamId, resultLimit = 5) {
  const games = await fetchOwnedGames(steamId);
  const topGames = [...games]
    .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
    .slice(0, GAMES_TO_CHECK);

  const perGameResults = await Promise.all(
    topGames.map(async (game) => {
      try {
        const achievements = await fetchAchievements(steamId, game.appid);
        return achievements
          .filter((a) => a.achieved === 1 && a.unlocktime > 0)
          .map((a) => ({ ...a, appid: game.appid, gameName: game.name }));
      } catch {
        return []; // this game might not have achievements at all, or a private/edge-case response — skip it
      }
    })
  );

  const unlocked = perGameResults.flat().sort((a, b) => b.unlocktime - a.unlocktime);
  const topUnlocks = unlocked.slice(0, resultLimit);
  if (topUnlocks.length === 0) return [];

  // Only fetch schema/rarity for the games actually represented in
  // the final short list, not every candidate game checked above.
  const uniqueAppIds = [...new Set(topUnlocks.map((a) => a.appid))];
  const enrichmentByAppId = {};
  await Promise.all(
    uniqueAppIds.map(async (appid) => {
      try {
        const [schema, percentages] = await Promise.all([
          fetchAchievementSchema(appid),
          fetchGlobalAchievementPercentages(appid),
        ]);
        enrichmentByAppId[appid] = { schema, percentages };
      } catch {
        enrichmentByAppId[appid] = { schema: [], percentages: [] };
      }
    })
  );

  return topUnlocks.map((a) => {
    const { schema = [], percentages = [] } = enrichmentByAppId[a.appid] || {};
    const schemaEntry = schema.find((s) => s.name === a.apiname);
    const percentEntry = percentages.find((p) => p.name === a.apiname);
    return {
      name: schemaEntry?.displayName || a.apiname,
      description: schemaEntry?.description || "",
      icon: schemaEntry?.icon || null,
      gameName: a.gameName,
      unlockTime: a.unlocktime,
      globalPercent: percentEntry ? Number(percentEntry.percent) : null,
    };
  });
}

// Records a real 100%-achievement completion the first time it's seen
// for this person+game, and fans it out as a "game_completed" Guild
// Pulse event — same logActivityForUser path every other real event
// uses. Steam only (see schema.sql's game_completions table comment).
// The unique (user_id, appid) constraint is what actually prevents a
// duplicate alert, not this function — a 23505 conflict here just
// means the completion was already recorded, so this returns false
// instead of re-firing the activity.
export async function recordGameCompletionIfNew(userId, { appid, gameName, totalAchievements }) {
  const { error } = await supabase
    .from("game_completions")
    .insert({ user_id: userId, appid, game_name: gameName, total_achievements: totalAchievements });
  if (error) {
    if (error.code !== "23505") console.error("Failed to record game completion:", error);
    return false;
  }
  await logActivityForUser(userId, "game_completed", { title: gameName, appid, totalAchievements });
  return true;
}
