// MTG source adapter — Scryfall's real "Unique Artwork" bulk file,
// confirmed live: one entry per visually distinct card+art combo (not
// one per every foil/nonfoil/frame-treatment reprint of the same art),
// which is exactly the right scope for visual matching — a physical
// card's face only needs one hash per distinct look, and indexing
// every SKU-level reprint would bloat the index without improving
// match quality.
//
// Double-faced cards store their images under card_faces[].image_uris
// instead of a top-level image_uris — confirmed live (e.g. any real
// MDFC). Only the front face is indexed; a person scanning a card
// shows the front by default, same assumption goagain/pokemontcg.io's
// single-image-per-entry shape already makes for their own games.

import zlib from "node:zlib";
import { fetchWithRetry, USER_AGENT_HEADERS } from "./http.mjs";

export const GAME_ID = "mtg";

// Real shape confirmed live: bulk-data entries expose a gzipped JSONL
// file (jsonl_download_uri), one JSON object per line — not a single
// plain .json array like the field name might suggest at a glance.
export async function* iterateCards() {
  const bulkListRes = await fetchWithRetry("https://api.scryfall.com/bulk-data", { headers: USER_AGENT_HEADERS });
  const bulkList = await bulkListRes.json();
  const entry = bulkList.data.find((d) => d.type === "unique_artwork");
  if (!entry) throw new Error("Scryfall bulk-data has no unique_artwork entry");

  const dataRes = await fetchWithRetry(entry.jsonl_download_uri, { headers: USER_AGENT_HEADERS });
  const gzipped = Buffer.from(await dataRes.arrayBuffer());
  const jsonl = zlib.gunzipSync(gzipped).toString("utf8");
  const cards = jsonl
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  for (const card of cards) {
    const imageUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
    if (!imageUrl) continue; // tokens/art-series/etc. without a real face image — skip, not guess
    yield {
      id: card.id,
      name: card.name,
      set: card.set,
      imageUrl,
    };
  }
}
