// Xbox/PSN library import — adds real owned/played games to Gaming
// Collection's real game_library_items table (see lib/gameLibrary.js
// for why that's a separate table from Backlog, not the same one this
// used to write to: bulk-importing someone's full Xbox/PSN library
// into Backlog's 4-state model silently defaulted every imported game
// to status "backlog" (not yet played), which is wrong for games
// they've already finished). Not the Wishlist either — these are
// things a person already owns, not things they want. Mirrors
// lib/wishlistImport.js's batch-with-progress shape.
//
// De-duplication is enforced at the DB level now (game_library_items
// has a real unique(user_id, platform, title) index) — addToGameLibrary
// silently no-ops a repeat, so this file doesn't need to check for
// existing rows itself the way the old Backlog-targeting version did.

import { addToGameLibrary } from "./gameLibrary";
import { fetchXboxLibrary } from "./xboxOAuth";
import { fetchPsnLibrary } from "./psnAuth";

async function importGames(userId, games, platform, onProgress) {
  let added = 0;
  for (let i = 0; i < games.length; i++) {
    onProgress?.(i + 1, games.length);
    const name = games[i].name;
    if (!name) continue;
    if (await addToGameLibrary(userId, name, platform)) added += 1;
  }
  return { total: games.length, added };
}

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
