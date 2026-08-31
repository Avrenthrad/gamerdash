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

export async function importXboxLibrary(userId, onProgress) {
  const { games } = await fetchXboxLibrary();
  if (!games || games.length === 0) throw new Error("No Xbox title history found.");
  return importGames(userId, games, "xbox", onProgress, buildParentMap(games));
}

export async function importPsnLibrary(userId, onProgress) {
  const { games } = await fetchPsnLibrary();
  if (!games || games.length === 0) throw new Error("No PlayStation played games found.");
  return importGames(userId, games, "playstation", onProgress, buildParentMap(games));
}

export async function importSteamLibrary(userId, linkedSteamId, onProgress) {
  const games = await fetchOwnedGames(linkedSteamId);
  if (!games || games.length === 0) throw new Error("No Steam games found.");

  const parentByTitle = new Map();
  for (let i = 0; i < games.length; i += STEAM_INFO_BATCH) {
    const batch = games.slice(i, i + STEAM_INFO_BATCH);
    await Promise.all(batch.map(async (game) => {
      if (!game.name) return;
      try {
        const info = await resolveGameName(game.appid);
        if (info?.appType === "dlc" && info.parentTitle) {
          parentByTitle.set(game.name, info.parentTitle);
        }
      } catch {
        // Fall back to title heuristics during merge if appdetails fails.
      }
    }));
    onProgress?.(Math.min(i + batch.length, games.length), games.length);
  }

  const heuristicParents = buildParentMap(games);
  for (const [title, parentTitle] of heuristicParents) {
    if (!parentByTitle.has(title)) parentByTitle.set(title, parentTitle);
  }

  return importGames(userId, games, "steam", onProgress, parentByTitle);
}
