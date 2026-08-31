// Xbox/PSN/Steam library import — adds real owned/played games to Gaming
// Collection's real game_library_items table (see lib/gameLibrary.js).
// DLC rows are stored with parent_title so the collection UI can show
// purchased add-ons under the base game card.

import { addToGameLibrary, inferParentTitleFromName } from "./gameLibrary";
import { fetchOwnedGames, resolveGameName } from "./steam";
import { fetchXboxLibrary } from "./xboxOAuth";
import { fetchPsnLibrary } from "./psnAuth";

const STEAM_INFO_BATCH = 8;

async function importGames(userId, games, platform, onProgress, parentByTitle = null) {
  let added = 0;
  for (let i = 0; i < games.length; i++) {
    onProgress?.(i + 1, games.length);
    const game = games[i];
    const name = game.name;
    if (!name) continue;
    const parentTitle = parentByTitle?.get(name) || null;
    if (await addToGameLibrary(userId, name, platform, game.appid || null, parentTitle)) added += 1;
  }
  return { total: games.length, added };
}

function buildParentMap(games) {
  const baseTitleKeys = new Set(games.map((game) => game.name.trim().toLowerCase()));
  const parentByTitle = new Map();
  for (const game of games) {
    const parentTitle = inferParentTitleFromName(game.name, baseTitleKeys);
    if (parentTitle) parentByTitle.set(game.name, parentTitle);
  }
  return parentByTitle;
}

// Xbox/PSN have no equivalent to Steam's real appdetails/fullgame
// data — no public API exposes a real DLC/parent relationship for
// either platform (confirmed while researching account linking for
// both). Title-string heuristics (buildParentMap) were tried here
// previously and confirmed live to misfire badly on ordinary
// colon-subtitled sequels — an entire separate game like "Call of
// Duty: Black Ops" or "Final Fantasy IV: The After Years" reads
// identically to real DLC naming to a string match. With no
// authoritative signal available for these platforms at all, guessing
// does more harm than showing every title standalone, so neither
// import attempts parent-title inference.
export async function importXboxLibrary(userId, onProgress) {
  const { games } = await fetchXboxLibrary();
  if (!games || games.length === 0) throw new Error("No Xbox title history found.");
  return importGames(userId, games, "xbox", onProgress);
}

export async function importPsnLibrary(userId, onProgress) {
  const { games } = await fetchPsnLibrary();
  if (!games || games.length === 0) throw new Error("No PlayStation played games found.");
  return importGames(userId, games, "playstation", onProgress);
}

export async function importSteamLibrary(userId, linkedSteamId, onProgress) {
  const games = await fetchOwnedGames(linkedSteamId);
  if (!games || games.length === 0) throw new Error("No Steam games found.");

  // Steam alone has a real, authoritative signal: appdetails' own
  // "type" field and "fullgame" reference (see api/steam.js's appinfo
  // mode). A title only ever gets treated as DLC when Steam itself
  // says so. resolvedTitles tracks which titles that real check
  // actually completed for (DLC or not) — the string-heuristic
  // fallback below must only apply to titles where the real check
  // genuinely couldn't run (a network error), never to a title Steam
  // already confirmed is a real standalone game. The previous version
  // of this function didn't make that distinction and let the
  // heuristic silently overrule a confirmed "this is a real game" —
  // confirmed live wrongly nesting entire separate Call of Duty
  // titles as "DLC" of each other.
  const parentByTitle = new Map();
  const resolvedTitles = new Set();
  for (let i = 0; i < games.length; i += STEAM_INFO_BATCH) {
    const batch = games.slice(i, i + STEAM_INFO_BATCH);
    await Promise.all(batch.map(async (game) => {
      if (!game.name) return;
      try {
        const info = await resolveGameName(game.appid);
        resolvedTitles.add(game.name);
        if (info?.appType === "dlc" && info.parentTitle) {
          parentByTitle.set(game.name, info.parentTitle);
        }
      } catch {
        // Genuinely couldn't resolve this one title — fall back to
        // the title heuristic for it alone, below.
      }
    }));
    onProgress?.(Math.min(i + batch.length, games.length), games.length);
  }

  const heuristicParents = buildParentMap(games);
  for (const [title, parentTitle] of heuristicParents) {
    if (!parentByTitle.has(title) && !resolvedTitles.has(title)) parentByTitle.set(title, parentTitle);
  }

  return importGames(userId, games, "steam", onProgress, parentByTitle);
}
