// Shared platform wishlist-import logic — used by Account Linking
// (first-time import) and the Prices page resync buttons.
//
// Steam resolves appids to names in batches; Xbox/PSN return titles
// directly from the linked-account APIs (see api/pricing.js).

import { resolveSteamIdInput, fetchWishlist, resolveGameName } from "./steam";
import { fetchXboxWishlist } from "./xboxOAuth";
import { fetchPsnWishlist } from "./psnAuth";

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

async function importNamedWishlistItems(items, onAddToWishlist, onProgress) {
  if (!items || items.length === 0) {
    throw new Error("That wishlist is empty.");
  }

  let added = 0;
  for (let i = 0; i < items.length; i++) {
    onProgress?.(i + 1, items.length);
    const name = items[i].name;
    if (!name) continue;
    onAddToWishlist(name);
    added += 1;
  }

  return { total: items.length, added };
}

export async function importXboxWishlist(onAddToWishlist, onProgress) {
  const { items } = await fetchXboxWishlist();
  return importNamedWishlistItems(items, onAddToWishlist, onProgress);
}

export async function importPsnWishlist(onAddToWishlist, onProgress) {
  const { items } = await fetchPsnWishlist();
  return importNamedWishlistItems(items, onAddToWishlist, onProgress);
}
