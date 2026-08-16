// Client-side OCR for card scanning, via Tesseract.js — a real,
// well-established open-source OCR engine (WASM, runs entirely in
// the browser, no external API key or account needed at all).
//
// HONEST LIMITATION, confirmed from real-world testing by others
// building the exact same thing: a dedicated open-source MTG-scanning
// project (fortierq/mtgscan) tried Tesseract first and found the
// results "pretty bad" specifically on Magic's card-name font,
// eventually needing a paid cloud OCR service to get it working well.
// This is the free option — genuinely useful, but expect it to
// sometimes misread a character or two, especially on foils (glare)
// or slightly angled photos. That's exactly why the scan flow shows
// several candidate matches for confirmation rather than silently
// trusting the first OCR guess and adding it straight to your
// collection.
//
// Dynamically imported (not a top-level import) — Tesseract.js is a
// large WASM-based library, and every other page in this app
// shouldn't pay for that weight just because the scanner exists
// somewhere in the codebase.

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

// Returns the raw recognized text, plus individual lines — the
// caller decides which lines look like a plausible card name (the
// name is usually the most prominent line of letters near the top of
// the card, without digits/symbols mixed in).
export async function recognizeCardText(imageDataUrl) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageDataUrl);
  const lines = data.text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);
  return { fullText: data.text, lines };
}

// Best-effort heuristic for which OCR'd line is most likely the card
// name: prefer lines that are mostly letters/spaces (rules text and
// mana costs tend to include lots of digits/symbols OCR mangles),
// reasonably short (card names aren't paragraphs), and appear earlier
// in the scan (the name sits near the top of a real card).
export function guessNameCandidates(lines) {
  return lines
    .filter((l) => l.length >= 3 && l.length <= 40)
    .filter((l) => /^[a-zA-Z\s',.-]+$/.test(l))
    .slice(0, 5);
}
