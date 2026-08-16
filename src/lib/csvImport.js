// TCG collection CSV import — ManaBox, Collectr, or a generic CSV.
// File import only, no OAuth into those apps (they don't offer any).
// Real card matching happens against Scryfall (see lib/scryfall.js);
// nothing here invents a card that doesn't resolve to a real Scryfall
// printing — unmatched rows stay visibly unmatched in the review step
// rather than being silently guessed at.
//
// Column names vary between apps and even between versions of the
// same app's export, so rather than assuming one exact rigid schema
// per source, every row is matched against a list of known header
// aliases per logical field, case-insensitively. This isn't a guess
// at an undocumented API — it's a CSV a user uploads themselves, and
// being tolerant of header variation is the correct, standard way to
// build any CSV importer.

import { getCardById, getCardByName } from "./scryfall";

// ---------- CSV parsing (hand-rolled, no new dependency) ----------
// Handles quoted fields, embedded commas, embedded newlines, and
// escaped ("") quotes — the real edge cases in RFC 4180 CSV that a
// naive split(",") gets wrong.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return {
    headers,
    rows: dataRows.map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    }),
  };
}

// ---------- Header aliasing ----------
const FIELD_ALIASES = {
  name: ["name", "card name", "product name"],
  setCode: ["set code", "set", "edition code", "expansion", "expansion code"],
  setName: ["set name", "edition", "expansion name"],
  collectorNumber: ["collector number", "card number", "number"],
  quantity: ["quantity", "qty", "count"],
  foil: ["foil", "printing", "finish"],
  scryfallId: ["scryfall id", "scryfallid"],
  condition: ["condition"],
  game: ["game", "tcg", "category"],
  binder: ["binder name", "binder", "list", "folder name"],
};

function findField(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((k) => k.toLowerCase().trim() === alias);
    if (match && row[match] !== "") return row[match];
  }
  return "";
}

export function mapCsvRow(row) {
  const name = findField(row, FIELD_ALIASES.name);
  const setCode = findField(row, FIELD_ALIASES.setCode);
  const setName = findField(row, FIELD_ALIASES.setName);
  const collectorNumber = findField(row, FIELD_ALIASES.collectorNumber);
  const quantityRaw = findField(row, FIELD_ALIASES.quantity);
  const foilRaw = findField(row, FIELD_ALIASES.foil);
  const scryfallId = findField(row, FIELD_ALIASES.scryfallId);
  const condition = findField(row, FIELD_ALIASES.condition);
  const gameRaw = findField(row, FIELD_ALIASES.game);
  const binder = findField(row, FIELD_ALIASES.binder);

  return {
    name,
    setCode: setCode ? setCode.toLowerCase() : "",
    setName,
    collectorNumber,
    quantity: Math.max(1, parseInt(quantityRaw, 10) || 1),
    foil: /foil/i.test(foilRaw) && !/non.?foil/i.test(foilRaw),
    scryfallId: scryfallId || null,
    condition: condition || null,
    game: gameRaw ? gameRaw.toLowerCase() : "mtg",
    binder: binder || null,
  };
}

// Only Magic is actually matchable right now (Scryfall is MTG-only) —
// every other game in a multi-game export (Collectr covers Pokémon/
// Yu-Gi-Oh/One Piece/etc.) gets an honest "not supported yet" status
// instead of being silently dropped or matched against the wrong game.
const MTG_GAME_LABELS = ["mtg", "magic", "magic: the gathering", ""];

export async function resolveCsvRow(mapped) {
  if (!MTG_GAME_LABELS.includes(mapped.game)) {
    return { ...mapped, status: "unsupported-game" };
  }
  if (!mapped.name && !mapped.scryfallId) {
    return { ...mapped, status: "unmatched", reason: "No card name or Scryfall ID in this row" };
  }

  try {
    let card = null;
    if (mapped.scryfallId) {
      card = await getCardById(mapped.scryfallId);
    }
    if (!card && mapped.name) {
      card = await getCardByName(mapped.name, mapped.setCode || undefined);
    }
    if (!card) return { ...mapped, status: "unmatched", reason: "No matching Scryfall card found" };
    return { ...mapped, status: "matched", card };
  } catch (err) {
    return { ...mapped, status: "error", reason: err.message };
  }
}

// Resolves every row against Scryfall with bounded concurrency —
// large imports (hundreds of cards) shouldn't fire hundreds of
// simultaneous requests at once against a free public API. Calls
// onProgress(done, total) after each row so the UI can show real
// progress instead of a spinner with no feedback.
export async function resolveCsvRows(mappedRows, onProgress) {
  const CONCURRENCY = 5;
  const results = new Array(mappedRows.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < mappedRows.length) {
      const index = cursor++;
      results[index] = await resolveCsvRow(mappedRows[index]);
      done++;
      onProgress?.(done, mappedRows.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, mappedRows.length) }, worker));
  return results;
}
