// Real, open, community-maintained Funko Pop catalog (github.com/
// kennymkchan/funko-pop-data) — plays the same role Rebrickable plays
// for LEGO in this schema: search real catalog data, add real
// matches, instead of inventing a product database or scraping the
// official Funko app (which has no public API and no confirmed export
// feature — verified before building this).
//
// Confirmed live columns: handle,title,imageName,series — no barcode/
// UPC field, so this is a name/series search, not a barcode match
// (see lib/upc.js for the separate generic-barcode path).
//
// Fetched directly from jsdelivr's public GitHub CDN mirror rather
// than proxied through our own /api/* — it's a static public file with
// no key to hide, and proxying a large CSV through a Vercel function
// would burn one of the 12 Hobby-tier function slots and risk their
// response-size limit for zero benefit over jsdelivr's own CDN caching.

import { getCached, setCached, CACHE_TTL } from "./cache";

const CSV_URL = "https://cdn.jsdelivr.net/gh/kennymkchan/funko-pop-data@master/funko_pop.csv";
const CACHE_KEY = "gd-funko-catalog";

// Minimal CSV parser with quoted-field support — titles/series can
// legitimately contain commas (e.g. "Freddy, Jason & Michael").
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function loadCatalog() {
  const cached = getCached(CACHE_KEY, CACHE_TTL.ONE_WEEK);
  if (cached !== undefined) return cached;

  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error("Failed to load Funko Pop catalog");
  const text = await res.text();
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  const handleIdx = header.indexOf("handle");
  const titleIdx = header.indexOf("title");
  const imageIdx = header.indexOf("imageName");
  const seriesIdx = header.indexOf("series");

  // jsdelivr occasionally returns a real HTTP 200 with an error page
  // (e.g. "Failed to fetch ... from GitHub") instead of the CSV when
  // its own upstream fetch from GitHub fails — confirmed live. Catch
  // that here rather than silently treating it as an empty/broken
  // catalog, so the UI shows its real error state instead.
  if (titleIdx === -1 || handleIdx === -1) {
    throw new Error("Funko Pop catalog fetch returned an unexpected format");
  }

  const catalog = body
    .filter((r) => r.length >= header.length && r[titleIdx])
    .map((r) => ({
      handle: r[handleIdx],
      title: r[titleIdx],
      imageUrl: r[imageIdx] || null,
      series: r[seriesIdx] || "",
    }));

  setCached(CACHE_KEY, catalog);
  return catalog;
}

export async function searchFunkoCatalog(query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const catalog = await loadCatalog();
  return catalog
    .filter((p) => p.title.toLowerCase().includes(trimmed) || p.series.toLowerCase().includes(trimmed))
    .slice(0, 25);
}
