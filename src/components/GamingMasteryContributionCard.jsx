// Gaming dashboard — compact Gaming Mastery preview with level XP
// progress toward the next rank. Uses the same masteryScore /
// masteryXp / masteryLevel data GameMasterySection persists (see
// lib/gameMasteryData.js).

import { levelFromXp } from "../lib/gameMastery";

export default function GamingMasteryContributionCard({
  masteryScore,
  masteryLevel,
  masteryXp,
  masteryBreakdown,
  onOpenLinking,
}) {
  const hasData = (masteryBreakdown || []).length > 0 || (masteryScore || 0) > 0;
  const { xpIntoLevel, xpForNextLevel, progress } = levelFromXp(masteryXp || 0);
  const xpRemaining = Math.max(0, xpForNextLevel - xpIntoLevel);

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Gaming Mastery</span>
        <button type="button" className="linkish" onClick={onOpenLinking}>Full breakdown →</button>
      </div>

      {!hasData && (
        <p className="panel__status">
          Link Steam, or enter Xbox/PlayStation numbers on Account Linking, to see your Mastery progress here.
        </p>
      )}

      {hasData && (
        <>
          <div className="mastery-contribution__headline">
            <span className="hero-card__title">{Math.round(masteryScore)}</span>
            <span className="panel__status" style={{ margin: 0 }}>Level {masteryLevel}</span>
          </div>

          <div
            className="mastery-xp-bar mastery-contribution__xp-bar"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${xpRemaining.toLocaleString()} XP to level ${masteryLevel + 1}`}
          >
            <div className="mastery-xp-bar__fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <p className="mastery-contribution__xp-note">
            <span className="mastery-contribution__xp-remaining">{xpRemaining.toLocaleString()} XP</span>
            {" "}to Level {masteryLevel + 1}
            <span className="mastery-contribution__xp-meta">
              {" "}· {xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} this level
            </span>
          </p>
        </>
      )}
    </div>
  );
}
