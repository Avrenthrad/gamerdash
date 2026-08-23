// Browser-side counterpart to scripts/build-tcg-hash-index.mjs's
// Node/sharp image decoding — same target grid (HASH_WIDTH x
// HASH_HEIGHT), same computeDHash() call, just fed from a <canvas>
// 2D context instead of sharp's raw buffer. Keeping this as thin as
// possible around the shared algorithm is the whole point: if the two
// sides ever computed pixels differently, every live match would be
// silently wrong against an index built the "other" way.

import { computeDHash, HASH_WIDTH, HASH_HEIGHT } from "./imageHash";

let hashCanvas = null;

function getHashCanvas() {
  if (!hashCanvas) {
    hashCanvas = document.createElement("canvas");
    hashCanvas.width = HASH_WIDTH;
    hashCanvas.height = HASH_HEIGHT;
  }
  return hashCanvas;
}

// source: anything drawImage accepts (a <video> element, an
// ImageBitmap, another canvas). sx/sy/sWidth/sHeight optionally crop
// to a sub-region first (the live scanner's on-screen alignment guide)
// instead of hashing the whole frame — the physical card only fills
// part of the camera view, and hashing the full frame (background,
// hands, table) would swamp the signal.
export function hashFromCanvasSource(source, region) {
  const canvas = getHashCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;

  if (region) {
    ctx.drawImage(source, region.sx, region.sy, region.sWidth, region.sHeight, 0, 0, HASH_WIDTH, HASH_HEIGHT);
  } else {
    ctx.drawImage(source, 0, 0, HASH_WIDTH, HASH_HEIGHT);
  }

  const { data } = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  const grayscale = new Array(HASH_WIDTH * HASH_HEIGHT);
  for (let i = 0; i < grayscale.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Standard luma weights — matches sharp's own .grayscale() well
    // enough that build-time and live hashes stay comparable.
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return computeDHash(grayscale);
}
