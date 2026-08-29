// Game Mastery Score — cross-platform "Gamerscore equivalent" and
// account XP/level. Every function here is pure (no network, no
// Supabase, no DOM) so the math is unit-testable on its own — the
// real, live/self-reported inputs get gathered and combined in
// lib/gameMasteryData.js, which calls into this module.

// ---------- Rarity multipliers ----------

// Steam (and any platform reporting a real global unlock percentage).
// null/undefined percent means "rarity unknown" — treated as common
// (1.0), never assumed rare, with the caller expected to label it as
// such rather than silently treating it like a verified common.
export function rarityMultiplierFromPercent(percent) {
  if (percent === null || percent === undefined || Number.isNaN(Number(percent))) return 1.0;
  const p = Number(percent);
  if (p <= 1) return 3.0;
  if (p <= 5) return 2.2;
  if (p <= 15) return 1.6;
  if (p <= 30) return 1.3;
  if (p <= 50) return 1.1;
  return 1.0;
}

export const PS_TROPHY_TIERS = ["bronze", "silver", "gold", "platinum"];
export const PS_TROPHY_TIER_POINTS = {
  bronze: 15,
  silver: 30,
  gold: 90,
  platinum: 180,
};

// ---------- Per-platform raw scores ----------

// xboxScore = 100 * log10(1 + gamerscore)
export function computeXboxScore(gamerscore) {
  const g = Math.max(0, Number(gamerscore) || 0);
  return 100 * Math.log10(1 + g);
}

// counts: { bronze: number, silver: number, gold: number, platinum: number }
// Each value is a real count of trophies the person has earned in
// that tier — no rarity weighting. Rarity multipliers were removed:
// PlayStation doesn't expose a real per-trophy rarity percentage the
// way Steam does, so the old 4-tier "common/rare/very_rare/ultra_rare"
// buckets were a person's own subjective read of their own trophy
// case, not verified data — dropped in favor of just the tier counts,
// which are what's actually printed on a PSN trophy list. Missing
// tiers are treated as 0, not skipped — a genuinely empty set of
// counts just scores 0, same as no trophies.
export function computePsScore(counts) {
  if (!counts) return 0;
  let total = 0;
  for (const tier of PS_TROPHY_TIERS) {
    const count = Math.max(0, Number(counts[tier]) || 0);
    total += count * PS_TROPHY_TIER_POINTS[tier];
  }
  return total;
}

// achievements: [{ unlockPercent: number | null }] — one entry per
// real unlocked Steam achievement (see lib/gameMasteryData.js for how
// these get gathered from the real Steam Web API).
export function computeSteamScore(achievements) {
  if (!achievements || achievements.length === 0) return 0;
  return achievements.reduce(
    (sum, a) => sum + 10 * rarityMultiplierFromPercent(a.unlockPercent),
    0
  );
}

// ---------- Combining into one uncapped Mastery Score ----------

// norm(x, typicalMax) = 1000 * (x / typicalMax)
// Linear, deliberately uncapped — typicalMax is a reference point
// ("about what a genuinely serious player hits"), not a ceiling. The
// previous exponential diminishing-returns curve asymptoted at 1000
// no matter how high the raw score got, which meant any reasonably
// dedicated player (a few dozen platinums, a 100%'d achievement-heavy
// library) saturated the display to "1000/1000" - the cap was hiding
// real differences between players well past typicalMax, not
// protecting the scale from anything. Going well beyond typicalMax
// now just keeps climbing past 1000 instead of getting flattened.
export function normalize(x, typicalMax) {
  if (!typicalMax || typicalMax <= 0) return 0;
  return 1000 * (Math.max(0, x) / typicalMax);
}

export const TYPICAL_MAX = {
  xbox: 500,
  // Lowered from 8000 alongside removing PS_RARITY_MULTIPLIERS above —
  // that removal drops real raw totals by roughly the old average
  // multiplier (~1.5x), so keeping 8000 here would have made 1000
  // quietly mean "a less dedicated player" than it used to.
  playstation: 5300,
  steam: 5000,
};

// rawScores: { xbox?: number, playstation?: number, steam?: number }
// — a platform key is only present when that platform is actually
// linked/reported; a platform with no real data contributes nothing,
// per the "missing platform = score from platforms present only" rule.
// Returns null when nothing is linked at all (never a fabricated 0
// pretending to be a real score for someone with no data anywhere).
export function computeMasteryScore(rawScores) {
  const entries = Object.entries(rawScores || {}).filter(
    ([, v]) => v !== null && v !== undefined
  );
  if (entries.length === 0) return null;

  const normalized = entries.map(([platform, raw]) => ({
    platform,
    raw,
    normalized: normalize(raw, TYPICAL_MAX[platform] || 1000),
  }));

  const masteryScore =
    normalized.reduce((sum, n) => sum + n.normalized, 0) / normalized.length;

  return { masteryScore, breakdown: normalized };
}

// ---------- Account XP / Level ----------

// accountXP_from_mastery = floor(masteryScore * 10)
export function accountXpFromMastery(masteryScore) {
  return Math.floor((masteryScore || 0) * 10);
}

// Triangular curve: cumulative XP required to REACH level L is
// 100 * L * (L + 1) — level 0 needs 0 XP, level 1 needs 200, level 2
// needs 600, etc.
export function cumulativeXpForLevel(level) {
  return 100 * level * (level + 1);
}

// Returns the current level for a given XP total, plus enough to
// drive an XP progress bar: how far into the current level, and how
// much the current level actually spans.
export function levelFromXp(xp) {
  const totalXp = Math.max(0, Number(xp) || 0);

  // Closed-form estimate from solving 100*L*(L+1) <= xp for L, then
  // nudged to the exact integer level — avoids an unbounded loop for
  // pathologically large XP values while staying exact.
  let level = Math.max(0, Math.floor((-100 + Math.sqrt(10000 + 400 * totalXp)) / 200));
  while (cumulativeXpForLevel(level + 1) <= totalXp) level += 1;
  while (level > 0 && cumulativeXpForLevel(level) > totalXp) level -= 1;

  const xpIntoLevel = totalXp - cumulativeXpForLevel(level);
  const xpForNextLevel = cumulativeXpForLevel(level + 1) - cumulativeXpForLevel(level);

  return {
    level,
    xpIntoLevel,
    xpForNextLevel,
    progress: xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 0,
  };
}
