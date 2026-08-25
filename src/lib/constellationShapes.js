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
// Design rule learned the hard way: 12 points spaced roughly evenly
// around a center — even a deliberately "faceted dodecagon" — just
// reads as a circle at a glance, particle jitter or not. Every shape
// below is built from clearly UNEVEN radii and sharp direction changes
// (concave notches, alternating near/far vertices, straight zigzags)
// specifically so the outline can't collapse into a smooth ring.
export const CONSTELLATION_SHAPES = {
  // Game controller: wide rounded body, concave double-notch along
  // the bottom edge standing in for the two grip bumps — the notch is
  // what keeps this from reading as a plain oval.
  gaming: [
    [40, 80], [46, 64], [70, 60], [80, 60], [104, 64], [110, 80],
    [104, 96], [92, 92], [82, 84], [68, 84], [58, 92], [46, 96],
  ],
  // Fanned hand of cards: three sharp-cornered peaks (the card tops)
  // separated by two valleys (where adjacent cards overlap), flat
  // bottom edge — zigzag top is what reads as "cards", not a dome.
  tcg: [
    [38, 90], [36, 55], [58, 35], [75, 50], [75, 28], [92, 50],
    [94, 35], [114, 55], [116, 90], [100, 100], [75, 103], [50, 100],
  ],
  // Clapperboard: zigzag clapper edge over a rectangular body.
  entertainment: [
    [32, 58], [46, 40], [58, 50], [70, 36], [82, 48], [96, 38],
    [112, 58], [112, 80], [112, 108], [72, 108], [32, 108], [32, 80],
  ],
  // Trophy: wide cup rim -> narrow neck -> wide flat base. Pushed the
  // rim/base width and neck narrowness further apart than the first
  // pass so the hourglass silhouette actually reads as a goblet
  // instead of a rounded blob. Down the right side through the neck
  // to the base, straight across, back up the left side — the two
  // neck points on each side sit adjacent to their own side's path
  // (not both in the middle of the array), since putting them out of
  // perimeter order self-intersects into an X instead of a trophy.
  collectibles: [
    [45, 32], [75, 24], [105, 32], [98, 52], [82, 66], [84, 92],
    [104, 108], [104, 116], [46, 116], [46, 108], [66, 92], [52, 66],
  ],
  // d20: alternating far/near radius every 30° — a hexagonal
  // star/gear silhouette with 6 real points, not a smooth dodecagon.
  // The earlier version spaced all 12 points at the SAME radius,
  // which is mathematically just a circle with extra vertices —
  // alternating radius is what actually reads as faceted.
  tabletop: [
    [75, 22], [90, 46], [118, 47], [105, 72], [118, 97], [90, 98],
    [75, 122], [60, 98], [32, 97], [45, 72], [32, 47], [60, 46],
  ],
};

export const CONSTELLATION_ORDER = ["gaming", "tcg", "entertainment", "collectibles", "tabletop"];
