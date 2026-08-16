// GD Score — a real, computed number instead of the static 0 it's
// been sitting at since day one.
//
// Deliberately built from data this project can actually verify is
// real and available (Steam-only, same honest scoping as everything
// else): library size, total playtime, and wishlist activity.
// Achievement-completion weighting would be a reasonable next
// addition, but pulling per-game achievement data for a whole library
// just to compute one number isn't worth the extra API load right
// now — this is a genuine v1, not the final formula.
//
// Formula (all real numbers, arbitrary but sensible weights):
//   owned games   × 5   — rewards a real library, not a huge one
//   playtime hours × 1  — rewards actually playing, not just owning
//   wishlist size × 10  — rewards using Lykodex itself

import { fetchOwnedGames } from "./steam";

export async function computeGdScore(steamId, wishlistLength) {
  if (!steamId) return Math.round((wishlistLength || 0) * 10);

  try {
    const games = await fetchOwnedGames(steamId);
    const totalPlaytimeHours = games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60;
    const libraryScore = games.length * 5;
    const playtimeScore = Math.round(totalPlaytimeHours);
    const wishlistScore = (wishlistLength || 0) * 10;
    return Math.round(libraryScore + playtimeScore + wishlistScore);
  } catch (err) {
    console.error("GD Score computation failed:", err);
    return Math.round((wishlistLength || 0) * 10); // still count wishlist even if Steam data fails
  }
}
