// Crunchyroll/Kindle/Audible library import — adds real owned/
// watched titles to Library College's media_library_items table (see
// lib/mediaLibrary.js for why that's separate from
// entertainment_entries). Mirrors lib/libraryImport.js's Gaming
// equivalent batch-with-progress shape.

import { addToMediaLibrary } from "./mediaLibrary";
import { fetchCrunchyrollLibrary } from "./crunchyrollAuth";

async function importTitles(userId, titles, source, onProgress) {
  let added = 0;
  for (let i = 0; i < titles.length; i++) {
    onProgress?.(i + 1, titles.length);
    const title = titles[i];
    if (!title) continue;
    if (await addToMediaLibrary(userId, title, source)) added += 1;
  }
  return { total: titles.length, added };
}

export async function importCrunchyrollLibrary(userId, onProgress) {
  const { titles } = await fetchCrunchyrollLibrary();
  if (!titles || titles.length === 0) throw new Error("No Crunchyroll watch history found.");
  return importTitles(userId, titles, "crunchyroll", onProgress);
}
