// Loads a game's pre-built perceptual-hash index (see
// scripts/build-tcg-hash-index.mjs) and finds the closest real card
// matches for a live-captured hash — the actual "recognition" step
// behind the live scanner. Runs entirely client-side against a index
// fetched once and cached: no per-scan network call, no paid image-
// recognition API.

import { hammingDistance } from "./imageHash";

const indexCache = {}; // game -> array of {h, id, name, set}

export async function loadTcgIndex(game) {
  if (indexCache[game]) return indexCache[game];
  const res = await fetch(`/tcg-hash-index-${game}.json`);
  if (!res.ok) throw new Error(`Couldn't load the ${game} card index (${res.status})`);
  const data = await res.json();
  indexCache[game] = data;
  return data;
}

// maxDistance=16 is a starting point, not a scientifically tuned
// number — a 64-bit dHash puts unrelated images around ~32 bits
// apart on average, and a real same-card-different-lighting photo
// from this project's own smoke testing landed single digits to
// ~15. Worth revisiting once this has real camera mileage across all
// three games rather than treating it as final.
export function findBestMatches(index, queryHash, { limit = 3, maxDistance = 16 } = {}) {
  const scored = [];
  for (const entry of index) {
    const distance = hammingDistance(queryHash, entry.h);
    if (distance <= maxDistance) scored.push({ id: entry.id, cardId: entry.cardId, name: entry.name, set: entry.set, distance });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
}
