// Xbox/PSN library import — adds real owned/played games to the
// existing Backlog (backlog_items already has a real `platform`
// column, see lib/backlog.js), the same target Steam manually-added
// games land in, not the Wishlist (these are things a person already
// owns, not things they want). Mirrors lib/wishlistImport.js's
// batch-with-progress shape.
//
// De-duplicates against the person's EXISTING backlog by title
// (case-insensitive) before inserting anything — backlog_items has no
// unique constraint to fall back on, unlike wishlist's
// unique(user_id, title), so this file is the only thing preventing a
// second import (or a title someone already added by hand) from
// creating a duplicate row.

import { fetchBacklog, addToBacklog } from "./backlog";
import { fetchXboxLibrary } from "./xboxOAuth";
import { fetchPsnLibrary } from "./psnAuth";

async function importGames(userId, games, platform, onProgress) {
  const existing = await fetchBacklog(userId);
  const existingTitles = new Set(existing.map((item) => item.title.toLowerCase()));

  let added = 0;
  for (let i = 0; i < games.length; i++) {
    onProgress?.(i + 1, games.length);
    const name = games[i].name;
    if (!name || existingTitles.has(name.toLowerCase())) continue;
    await addToBacklog(userId, name, null, platform);
    existingTitles.add(name.toLowerCase());
    added += 1;
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
