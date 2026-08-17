// Real Steam friends + live activity + achievement-based progress —
// powers the Friends dashboard now that it's merged with Progress.
//
// Honest note on "progress": no platform (Steam included) publishes a
// literal "% through the story" for an arbitrary game — that's not a
// real data point anywhere. What's shown here is achievement
// completion (unlocked ÷ total achievements), a genuine, commonly-used
// proxy for progress, not a claim of narrative completion percentage.
//
// This only works for a linked Steam account, and only surfaces
// friends/games whose privacy settings are public — Steam simply
// won't return data for anything set to private, which shows up here
// as an empty result rather than an error.

import {
  fetchFriendList,
  fetchPlayerSummaries,
  fetchOwnedGames,
  fetchAchievements,
  fetchAchievementSchema,
} from "./steam";

const FRIEND_LIMIT = 8;

async function achievementCompletion(steamId, appid) {
  try {
    const [achievements, schema] = await Promise.all([
      fetchAchievements(steamId, appid).catch(() => []),
      fetchAchievementSchema(appid).catch(() => []),
    ]);
    if (schema.length === 0) return null; // this game has no achievements at all
    const unlocked = achievements.filter((a) => a.achieved === 1).length;
    return Math.round((unlocked / schema.length) * 100);
  } catch {
    return null;
  }
}

// Real friends list, each with live online/in-game status and (when
// they're currently in a game) their achievement completion for it.
export async function fetchRealFriends(steamId) {
  const friendRefs = await fetchFriendList(steamId);
  if (friendRefs.length === 0) return []; // empty or private friends list

  const ids = friendRefs.slice(0, FRIEND_LIMIT).map((f) => f.steamid);
  const summaries = await fetchPlayerSummaries(ids);

  return Promise.all(
    summaries.map(async (p) => ({
      steamid: p.steamid,
      name: p.personaname,
      avatar: p.avatarfull,
      online: p.personastate > 0,
      playing: p.gameextrainfo || null,
      progress: p.gameid ? await achievementCompletion(p.steamid, p.gameid) : null,
    }))
  );
}

// The linked account's own current activity: whatever they're playing
// right now, or their most-played game if they're not currently in
// anything — with real playtime and achievement-based progress.
export async function fetchOwnProgress(steamId) {
  const [summary] = await fetchPlayerSummaries([steamId]);
  const isCurrentlyPlaying = Boolean(summary?.gameid);

  let appid = summary?.gameid;
  let gameName = summary?.gameextrainfo;

  const games = await fetchOwnedGames(steamId);

  if (!appid) {
    const topGame = [...games].sort(
      (a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0)
    )[0];
    if (!topGame) return null; // no owned games visible at all
    appid = topGame.appid;
    gameName = topGame.name;
  }

  const gameEntry = games.find((g) => String(g.appid) === String(appid));

  return {
    appid,
    gameName: gameName || gameEntry?.name || "Unknown game",
    thumb: gameEntry?.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${gameEntry.img_icon_url}.jpg`
      : null,
    playtimeHours: Math.round((gameEntry?.playtime_forever || 0) / 60),
    completionPct: await achievementCompletion(steamId, appid),
    isCurrentlyPlaying,
  };
}
