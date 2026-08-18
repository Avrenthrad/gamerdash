// Gaming dashboard — compact "why is my Mastery Score what it is"
// preview. Reuses the exact same masteryScore/masteryBreakdown data
// GameMasterySection already computes and persists (see
// lib/gameMasteryData.js) — no separate fetch, no separate math, just
// a smaller "at a glance" render of the same real numbers, with a link
// to the full breakdown on Account Linking.

const PLATFORM_LABELS = { xbox: "Xbox", playstation: "PlayStation", steam: "Steam" };

export default function GamingMasteryContributionCard({ masteryScore, masteryLevel, masteryBreakdown, onOpenLinking }) {
  const hasData = (masteryBreakdown || []).length > 0;

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Gaming Mastery</span>
        <button type="button" className="linkish" onClick={onOpenLinking}>Full breakdown →</button>
      </div>

      {!hasData && (
        <p className="panel__status">
          Link Steam, or enter Xbox/PlayStation numbers on Account Linking, to see your Mastery breakdown here.
        </p>
      )}

      {hasData && (
        <>
          <div className="mastery-contribution__headline">
            <span className="hero-card__title">{Math.round(masteryScore)}</span>
            <span className="panel__status" style={{ margin: 0 }}>Level {masteryLevel}</span>
          </div>
          <ul className="mastery-contribution__list">
            {masteryBreakdown.map((entry) => (
              <li key={entry.platform} className="mastery-contribution__row">
                <span className="mastery-contribution__platform">{PLATFORM_LABELS[entry.platform] || entry.platform}</span>
                <div className="mastery-contribution__bar">
                  <div className="mastery-contribution__bar-fill" style={{ width: `${Math.min(100, entry.normalized / 10)}%` }} />
                </div>
                <span className="mastery-contribution__score">{Math.round(entry.normalized)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
