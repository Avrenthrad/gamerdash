// Point sets for the Constellation Marks hero (CollegeMorphHero.jsx) —
// a loose, drifting-particle silhouette per College instead of a flat
// icon badge. Each shape is exactly 12 points in a 150x150 space so
// morphing between any two Colleges is a clean 1:1 position
// interpolation (point i always moves to point i, never a resize of
// the array), and each shape's points are ordered clockwise starting
// near the top so the interpolation itself reads as a coherent
// rotation/reshaping rather than a scramble.
//
// These are deliberately loose impressions, not crisp line-art icons —
// the whole point of "particles drifting into a shape" is that it
// never looks quite the same twice, so exact fidelity to a real
// controller/card-fan/etc. matters less than a recognizable gesture
// at a glance, combined with the label and accent color.
export const CONSTELLATION_SHAPES = {
  // Game controller: rounded body + twin grip bumps.
  gaming: [
    [40, 80], [46, 64], [70, 60], [80, 60], [104, 64], [110, 80],
    [104, 96], [92, 92], [82, 84], [68, 84], [58, 92], [46, 96],
  ],
  // Fanned hand of cards: wide arc top, flatter bottom.
  tcg: [
    [40, 95], [38, 60], [48, 40], [62, 32], [75, 30], [88, 32],
    [102, 40], [112, 60], [110, 95], [85, 102], [75, 104], [60, 102],
  ],
  // Clapperboard: zigzag clapper edge over a rectangular body.
  entertainment: [
    [32, 58], [46, 40], [58, 50], [70, 36], [82, 48], [96, 38],
    [112, 58], [112, 80], [112, 108], [72, 108], [32, 108], [32, 80],
  ],
  // Trophy: cup rim, cup body, stem, base.
  collectibles: [
    [52, 35], [75, 28], [98, 35], [94, 55], [80, 68], [80, 80],
    [95, 100], [105, 112], [45, 112], [55, 100], [70, 80], [56, 55],
  ],
  // d20: rounded dodecagon standing in for a many-sided die.
  tabletop: [
    [75, 25], [90, 30], [105, 45], [114, 68], [114, 92], [102, 110],
    [75, 120], [48, 110], [36, 92], [36, 68], [45, 45], [60, 30],
  ],
};

export const CONSTELLATION_ORDER = ["gaming", "tcg", "entertainment", "collectibles", "tabletop"];
