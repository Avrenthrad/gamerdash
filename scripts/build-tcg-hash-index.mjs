// Builds a perceptual-hash index for real-time visual card matching
// (see src/lib/imageHash.js for the algorithm both this script and the
// live client scanner share). Run per-game:
//
//   node scripts/build-tcg-hash-index.mjs --game=mtg
//   node scripts/build-tcg-hash-index.mjs --game=pokemon
//   node scripts/build-tcg-hash-index.mjs --game=fab
//
// Downloads every real card image for the chosen game (tens of
// thousands for MTG/Pokémon), resizes each to the same 9x8 grid
// computeDHash expects, and writes public/tcg-hash-index-<game>.json —
// a compact {h, id, name, set} array the client fetches once and
// matches live camera frames against locally (no per-scan network
// call, no paid recognition API).
//
// Resumable by design: re-running with the same --game skips any id
// already present in the existing output file, and progress is
// flushed to disk periodically, not just at the end — a long
// multi-hour run (this is tens of thousands of image downloads) can
// be safely interrupted and continued rather than restarted from zero.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { computeDHash, HASH_WIDTH, HASH_HEIGHT } from "../src/lib/imageHash.js";
import { fetchWithRetry, USER_AGENT_HEADERS } from "./tcg-sources/http.mjs";
import * as mtgSource from "./tcg-sources/mtg.mjs";
import * as pokemonSource from "./tcg-sources/pokemon.mjs";
import * as fabSource from "./tcg-sources/fab.mjs";

const SOURCES = {
  mtg: mtgSource,
  pokemon: pokemonSource,
  fab: fabSource,
};

const CONCURRENCY = 8;
const FLUSH_EVERY = 50;
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../public");

function parseArgs() {
  const gameArg = process.argv.find((a) => a.startsWith("--game="));
  const game = gameArg?.split("=")[1];
  if (!game || !SOURCES[game]) {
    console.error(`Usage: node scripts/build-tcg-hash-index.mjs --game=${Object.keys(SOURCES).join("|")}`);
    process.exit(1);
  }
  return { game };
}

function loadExisting(outputPath) {
  if (!fs.existsSync(outputPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch (err) {
    console.error(`Couldn't parse existing ${outputPath}, starting fresh:`, err.message);
    return [];
  }
}

async function hashImageUrl(imageUrl) {
  const res = await fetchWithRetry(imageUrl, { headers: USER_AGENT_HEADERS });
  const buffer = Buffer.from(await res.arrayBuffer());
  const { data } = await sharp(buffer)
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return computeDHash(Array.from(data));
}

// Simple fixed-size worker pool over an async generator — no external
// queue library needed for a one-off build script.
//
// Two failure modes get handled very differently on purpose:
//   - hashImageUrl() failing for ONE card (bad image, 404, etc.) is
//     just skipped — logged and moved on, same as always.
//   - iterator.next() failing (a paginated source's page fetch
//     exhausted its own retries) ends the run entirely rather than
//     silently skipping — losing one card is fine, silently skipping
//     an entire page of ~100-250 cards is not the kind of thing that
//     should happen without it being obvious in the log. Either way
//     this resolves cleanly instead of throwing an unhandled
//     rejection (what actually crashed the process the first time
//     this ran, after several hundred entries had already been safely
//     flushed to disk) — whatever's already flushed stays intact, and
//     re-running the same command picks up where it left off.
async function processWithConcurrency(iterator, seenIds, onResult) {
  let active = 0;
  let pumping = false;

  return new Promise((resolve, reject) => {
    let iterDone = false;

    async function pump() {
      if (pumping) return; // re-entrancy guard — a recursive call from .finally() while this loop is still running would race the same `active` count
      pumping = true;
      try {
        while (!iterDone && active < CONCURRENCY) {
          let next;
          try {
            next = await iterator.next();
          } catch (err) {
            console.error(`Stopping — source iterator failed: ${err.message}`);
            iterDone = true;
            break;
          }
          if (next.done) {
            iterDone = true;
            break;
          }
          const card = next.value;
          if (seenIds.has(card.id)) continue; // already indexed from a previous run

          active++;
          hashImageUrl(card.imageUrl)
            .then((h) => {
              onResult({ h, id: card.id, name: card.name, set: card.set });
            })
            .catch((err) => {
              console.error(`Skipped ${card.id} (${card.name}): ${err.message}`);
            })
            .finally(() => {
              active--;
              pump();
            });
        }
      } finally {
        pumping = false;
      }
      if (iterDone && active === 0) resolve();
    }

    pump().catch(reject);
  });
}

async function main() {
  const { game } = parseArgs();
  const source = SOURCES[game];
  const outputPath = path.join(OUTPUT_DIR, `tcg-hash-index-${game}.json`);

  const existing = loadExisting(outputPath);
  const seenIds = new Set(existing.map((e) => e.id));
  const results = [...existing];

  console.log(`Building ${game} hash index — ${existing.length} already indexed, resuming...`);

  let sinceLastFlush = 0;
  function flush() {
    fs.writeFileSync(outputPath, JSON.stringify(results));
    console.log(`[${game}] flushed ${results.length} total entries to ${outputPath}`);
    sinceLastFlush = 0;
  }

  const startTime = Date.now();
  await processWithConcurrency(source.iterateCards(), seenIds, (entry) => {
    results.push(entry);
    seenIds.add(entry.id);
    sinceLastFlush++;
    if (results.length % 100 === 0) {
      const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`[${game}] ${results.length} indexed (${elapsedMin}m elapsed)`);
    }
    if (sinceLastFlush >= FLUSH_EVERY) flush();
  });

  flush();
  console.log(`[${game}] done — ${results.length} total entries.`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  // process.exitCode (not process.exit()) — lets Node drain its event
  // loop and close pending fetch/socket handles normally. A forced
  // exit() while a background image request was still in flight is
  // what triggered a real libuv assertion crash on Windows here.
  process.exitCode = 1;
});
