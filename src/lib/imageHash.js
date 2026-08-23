// Perceptual hash (dHash — difference hash) shared verbatim between
// the build-time index generator (scripts/build-mtg-hash-index.mjs,
// runs in Node) and the live client-side card scanner. Both sides
// call the exact same computeDHash() on the exact same 9x8 grayscale
// pixel layout, so a hash computed from a Scryfall reference image at
// build time is directly comparable (Hamming distance) to one
// computed from a live camera frame — if the two algorithms ever
// drifted apart, every match would silently be wrong.
//
// dHash over pHash: no DCT, just adjacent-pixel brightness
// comparisons — fast enough to run every animation frame on a phone
// and still robust to the resize/recompress/lighting differences
// between "official card scan" and "phone camera in someone's hands".
//
// Why 9x8 → 64 bits: a dHash needs one extra column of pixels to
// compare each column against its neighbor, so a 9-wide grid produces
// 8 comparisons per row; 8 rows × 8 comparisons = 64 bits, a
// convenient single BigInt/hex-string width.

export const HASH_WIDTH = 9;
export const HASH_HEIGHT = 8;

// pixels: grayscale intensities (0-255), row-major, HASH_WIDTH x
// HASH_HEIGHT long. Returns the hash as a lowercase hex string (16
// chars = 64 bits) — easy to store in JSON and compare byte-wise.
export function computeDHash(pixels) {
  if (pixels.length !== HASH_WIDTH * HASH_HEIGHT) {
    throw new Error(`computeDHash expects ${HASH_WIDTH * HASH_HEIGHT} pixels, got ${pixels.length}`);
  }
  let bits = "";
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = pixels[row * HASH_WIDTH + col];
      const right = pixels[row * HASH_WIDTH + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  // Pack the 64-bit string into hex, 4 bits at a time.
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

// Hamming distance between two hex-string hashes — how many of the 64
// bits differ. 0 = identical; real-world same-card matches from a
// phone camera typically land under ~10-12; unrelated cards are
// usually 24+. The scanner UI picks the actual threshold, this just
// computes the raw distance.
export function hammingDistance(hexA, hexB) {
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    let diff = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}
