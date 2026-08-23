// One-off: the FAB hash index started without a `cardId` field (added
// to tcg-sources/fab.mjs after the first index run was already most
// of the way done — see that file's comment). Re-fetches just the
// card listing (cheap — JSON pagination, no image downloads/hashing)
// to build a printingId -> cardId map, then merges it into the
// existing public/tcg-hash-index-fab.json in place. Safe to run
// multiple times; entries that already have cardId are left alone.

import fs from "node:fs";
import path from "node:path";
import { fetchWithRetry, USER_AGENT_HEADERS } from "./tcg-sources/http.mjs";

const OUTPUT_PATH = path.resolve(import.meta.dirname, "../public/tcg-hash-index-fab.json");
const LIMIT = 100;

async function buildPrintingToCardMap() {
  const map = new Map();
  let offset = 0;
  for (;;) {
    const res = await fetchWithRetry(`https://api.goagain.dev/v1/cards?limit=${LIMIT}&offset=${offset}`, {
      headers: USER_AGENT_HEADERS,
    });
    const json = await res.json();
    const cards = json.data || [];
    if (cards.length === 0) break;

    for (const card of cards) {
      for (const printing of card.printings || []) {
        map.set(printing.unique_id, card.unique_id);
      }
    }

    offset += LIMIT;
    console.log(`Mapped ${map.size} printings so far (offset ${offset}/${json.total})...`);
    if (offset >= json.total) break;
  }
  return map;
}

async function main() {
  const entries = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  const missing = entries.filter((e) => !e.cardId);
  console.log(`${entries.length} total entries, ${missing.length} missing cardId.`);
  if (missing.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const printingToCard = await buildPrintingToCardMap();

  let filled = 0;
  for (const entry of entries) {
    if (entry.cardId) continue;
    const cardId = printingToCard.get(entry.id);
    if (cardId) {
      entry.cardId = cardId;
      filled++;
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries));
  console.log(`Backfilled ${filled}/${missing.length} entries.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exitCode = 1;
});
