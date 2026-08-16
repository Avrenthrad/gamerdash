// Shared Steam-wishlist-import logic — used both by Account Linking
// (the first-time link + import) and the Prices page's resync button
// (re-running the same import against an already-linked Steam ID).
//
// Processed in batches rather than one giant Promise.all — friendlier
// to Steam's API for people with large wishlists.

import { resolveSteamIdInput, fetchWishlist, resolveGameName } from "./steam";

const BATCH_SIZE = 10;

// onProgress(currentCount, totalCount) is called after each batch, so
// the caller can show a live "Importing… X of Y" message.
export async function importSteamWishlist(steamIdOrProfileInput, onAddToWishlist, onProgress) {
  const steamId = await resolveSteamIdInput(steamIdOrProfileInput);
  if (!steamId) {
    throw new Error("Couldn't find that Steam profile.");
  }

  const items = await fetchWishlist(steamId);
  if (items.length === 0) {
    throw new Error("That wishlist is empty, or set to private.");
  }

  let added = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    onProgress?.(Math.min(i + BATCH_SIZE, items.length), items.length);

    const names = await Promise.all(
      batch.map((item) => resolveGameName(item.appid).catch(() => ({ name: null })))
    );
    names.forEach((info) => {
      if (info.name) {
        onAddToWishlist(info.name);
        added += 1;
      }
    });
  }

  return { steamId, total: items.length, added };
}
