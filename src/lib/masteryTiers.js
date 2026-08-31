// Mastery tiers — a named-badge system layered on top of the existing
// uncapped Overall Mastery Score (see lib/overallMastery.js), shared
// by both individual profiles and Guild Mastery Score (the average of
// a guild's own members' scores — see get_guild_mastery_average in
// schema.sql). Same tier bands for both: a "Gold" guild and a "Gold"
// player mean the same absolute score, since a guild's score is just
// an average on that identical scale.
//
// Thresholds are round numbers anchored to the real score range seen
// in production so far (2 real active users: ~312 and ~5,060) rather
// than percentile math — there's nowhere near enough real users yet
// for percentiles to mean anything, and round numbers give the system
// room to grow into as more real Colleges get filled in. Diamond
// (10,000+) is deliberately aspirational — nobody's there yet.
export const MASTERY_TIERS = [
  { id: "bronze", label: "Bronze", minScore: 0, color: "#B08D57" },
  { id: "silver", label: "Silver", minScore: 1000, color: "#B7BFC6" },
  { id: "gold", label: "Gold", minScore: 2500, color: "#D8B44A" },
  { id: "platinum", label: "Platinum", minScore: 5000, color: "#6FD6C9" },
  { id: "diamond", label: "Diamond", minScore: 10000, color: "#7EC8FF" },
];

// Returns the tier for a real score, plus enough to drive a progress
// bar toward the next tier — mirrors levelFromXp's shape
// (level/progress) so UI that already knows that pattern reads
// naturally here too. Diamond (the last tier) has no "next" — nextTier
// is null and progress is always 1.
export function tierFromScore(score) {
  const value = Math.max(0, Number(score) || 0);

  let tierIndex = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i++) {
    if (value >= MASTERY_TIERS[i].minScore) tierIndex = i;
  }

  const tier = MASTERY_TIERS[tierIndex];
  const nextTier = MASTERY_TIERS[tierIndex + 1] || null;
  const progress = nextTier
    ? Math.max(0, Math.min(1, (value - tier.minScore) / (nextTier.minScore - tier.minScore)))
    : 1;

  return {
    id: tier.id,
    label: tier.label,
    color: tier.color,
    minScore: tier.minScore,
    nextTier: nextTier ? { id: nextTier.id, label: nextTier.label, minScore: nextTier.minScore } : null,
    progress,
  };
}
