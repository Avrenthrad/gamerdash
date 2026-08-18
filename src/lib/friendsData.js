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

// Two real, honestly-distinct "what have you been playing" slides for
// ContinuePlayingCard's auto-rotation:
//   - "Last Played": live "currently playing" status if there is one
//     (the single most-recent real signal Steam offers), otherwise the
//     top game by playtime_2weeks as the best available recency proxy.
//   - "Most Played This Week": top game by playtime_2weeks specifically
//     (Steam's own real rolling ~2-week window — same data source as
//     the "Recently Played" shelf on an actual Steam profile).
// There is deliberately no true "last played" TIMESTAMP here — Steam's
// rtime_last_played field only populates when the calling API key
// belongs to the account being queried, not for a shared server key
// looking up an arbitrary linked account (confirmed live against a
// real linked account's own data, same limitation already documented
// for LibraryPage's "last played X days ago"). When someone isn't
// currently playing anything, both slides can honestly end up
// pointing at the same real game — that's not a bug, it just means
// that game really is both.
export async function fetchContinuePlayingSlides(steamId) {
  const [summary] = await fetchPlayerSummaries([steamId]);
  const isCurrentlyPlaying = Boolean(summary?.gameid);
  const games = await fetchOwnedGames(steamId);

  async function buildSlide({ label, appid, gameName, statMinutes, statLabel, live }) {
    const gameEntry = games.find((g) => String(g.appid) === String(appid));
    return {
      label,
      appid,
      gameName: gameName || gameEntry?.name || "Unknown game",
      thumb: gameEntry?.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${gameEntry.img_icon_url}.jpg`
        : null,
      statHours: Math.round((statMinutes || 0) / 60),
      statLabel,
      completionPct: await achievementCompletion(steamId, appid),
      isCurrentlyPlaying: live,
    };
  }

  if (games.length === 0 && !isCurrentlyPlaying) return [];

  const byRecent = [...games]
    .filter((g) => (g.playtime_2weeks || 0) > 0)
    .sort((a, b) => (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0));
  const byAllTime = [...games].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));

  const slides = [];

  if (isCurrentlyPlaying) {
    slides.push(await buildSlide({
      label: "Last Played",
      appid: summary.gameid,
      gameName: summary.gameextrainfo,
      statMinutes: games.find((g) => String(g.appid) === String(summary.gameid))?.playtime_forever,
      statLabel: "Playing now",
      live: true,
    }));
  } else if (byRecent[0]) {
    slides.push(await buildSlide({
      label: "Last Played",
      appid: byRecent[0].appid,
      gameName: byRecent[0].name,
      statMinutes: byRecent[0].playtime_forever,
      statLabel: "Total playtime",
      live: false,
    }));
  } else if (byAllTime[0]) {
    slides.push(await buildSlide({
      label: "Last Played",
      appid: byAllTime[0].appid,
      gameName: byAllTime[0].name,
      statMinutes: byAllTime[0].playtime_forever,
      statLabel: "Total playtime",
      live: false,
    }));
  }

  if (byRecent[0]) {
    slides.push(await buildSlide({
      label: "Most Played This Week",
      appid: byRecent[0].appid,
      gameName: byRecent[0].name,
      statMinutes: byRecent[0].playtime_2weeks,
      statLabel: "Last 2 weeks",
      live: false,
    }));
  } else if (byAllTime[0]) {
    slides.push(await buildSlide({
      label: "Most Played",
      appid: byAllTime[0].appid,
      gameName: byAllTime[0].name,
      statMinutes: byAllTime[0].playtime_forever,
      statLabel: "Total playtime",
      live: false,
    }));
  }

  return slides;
}
