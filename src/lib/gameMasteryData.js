// Game Mastery Score — real data gathering + Supabase persistence.
// The actual scoring math lives in lib/gameMastery.js (pure, no
// network); this file is the "wire it up to real data" half:
//   - Steam: fully live, via the real Steam Web API (unlocked
//     achievements + Steam's own global unlock-percent rarity).
//   - Xbox / PlayStation: self-reported — see mastery_inputs in
//     schema.sql and AccountLinkingPage.jsx for why (no public API
//     exists for a person's own earned Gamerscore/trophies on either
//     platform, confirmed while building Account Linking).

import { supabase } from "./supabaseClient";
import { fetchOwnedGames, fetchAchievements, fetchGlobalAchievementPercentages } from "./steam";
import {
  computeXboxScore,
  computePsScore,
  computeSteamScore,
  computeMasteryScore,
  accountXpFromMastery,
  levelFromXp,
} from "./gameMastery";

// Bounded the same way lib/achievements.js's "recent unlocks" feed
// is — scanning a person's entire Steam library (which can be
// hundreds of games) for one score isn't worth the API load. This
// scans more games than that feed (mastery is a periodic recompute,
// not a live view) but is still an honestly-labeled subset, not the
// whole library.
const GAMES_TO_SCAN = 15;

export async function fetchMasteryInputs(userId) {
  const { data, error } = await supabase
    .from("mastery_inputs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveXboxGamerscore(userId, gamerscore) {
  const { error } = await supabase.from("mastery_inputs").upsert(
    {
      user_id: userId,
      xbox_gamerscore: gamerscore,
      xbox_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function savePsTrophyCounts(userId, counts) {
  const { error } = await supabase.from("mastery_inputs").upsert(
    {
      user_id: userId,
      ps_trophy_counts: counts,
      ps_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// Real unlocked achievements (with real global unlock %) across a
// person's most-played owned games — same three genuine Steam Web API
// endpoints as the "recent achievements" feed, just without the
// display-name/icon schema lookup this doesn't need.
async function gatherSteamAchievements(steamId) {
  const games = await fetchOwnedGames(steamId);
  const topGames = [...games]
    .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
    .slice(0, GAMES_TO_SCAN);

  const perGame = await Promise.all(
    topGames.map(async (game) => {
      try {
        const [achievements, percentages] = await Promise.all([
          fetchAchievements(steamId, game.appid),
          fetchGlobalAchievementPercentages(game.appid),
        ]);
        const unlocked = achievements.filter((a) => a.achieved === 1);
        return unlocked.map((a) => {
          const percentEntry = percentages.find((p) => p.name === a.apiname);
          return { unlockPercent: percentEntry ? Number(percentEntry.percent) : null };
        });
      } catch {
        return []; // no achievements on this game, or a private/edge-case response — skip it
      }
    })
  );

  return { achievements: perGame.flat(), gamesScanned: topGames.length };
}

// The one function the rest of the app calls: gathers whatever real
// data is actually available (self-reported Xbox/PS inputs + live
// Steam data when linked), combines it via the pure scoring module,
// and persists the result on the profile — same cached-on-profile
// pattern as gd_score, recomputed on demand rather than every render.
export async function recomputeMastery(userId, linkedSteamId) {
  const inputs = await fetchMasteryInputs(userId).catch(() => null);

  const rawScores = {};
  const sources = {};

  if (inputs?.xbox_gamerscore !== null && inputs?.xbox_gamerscore !== undefined) {
    rawScores.xbox = computeXboxScore(inputs.xbox_gamerscore);
    sources.xbox = { source: "self_reported", asOf: inputs.xbox_updated_at, gamerscore: inputs.xbox_gamerscore };
  }

  if (inputs?.ps_trophy_counts) {
    rawScores.playstation = computePsScore(inputs.ps_trophy_counts);
    sources.playstation = { source: "self_reported", asOf: inputs.ps_updated_at };
  }

  if (linkedSteamId) {
    try {
      const { achievements, gamesScanned } = await gatherSteamAchievements(linkedSteamId);
      rawScores.steam = computeSteamScore(achievements);
      sources.steam = {
        source: "live_steam_api",
        asOf: new Date().toISOString(),
        gamesScanned,
        achievementsCounted: achievements.length,
      };
    } catch (err) {
      console.error("Steam mastery data fetch failed:", err);
    }
  }

  const combined = computeMasteryScore(rawScores);

  const result = combined
    ? {
        masteryScore: combined.masteryScore,
        accountXp: accountXpFromMastery(combined.masteryScore),
        breakdown: combined.breakdown.map((entry) => ({ ...entry, ...sources[entry.platform] })),
      }
    : { masteryScore: 0, accountXp: 0, breakdown: [] };

  const { level } = levelFromXp(result.accountXp);
  const computedAt = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      mastery_score: result.masteryScore,
      mastery_xp: result.accountXp,
      mastery_level: level,
      mastery_breakdown: result.breakdown,
      mastery_computed_at: computedAt,
    })
    .eq("id", userId);
  if (error) throw error;

  return {
    masteryScore: result.masteryScore,
    accountXp: result.accountXp,
    accountLevel: level,
    breakdown: result.breakdown,
    computedAt,
  };
}
