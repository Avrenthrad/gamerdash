// Game Mastery Score — cross-platform "Gamerscore equivalent" section
// of Account Linking. Steam, Xbox, and PlayStation are all fully live
// now (real unlocked achievements / real Gamerscore via Xbox Live
// sign-in / real trophy counts via PSN sync — see
// lib/gameMasteryData.js). No manual entry left for any of the three
// — confirmed all working end-to-end before removing the last of it
// (PlayStation's).

import { useState } from "react";
import { levelFromXp } from "../lib/gameMastery";

const PLATFORM_LABELS = { xbox: "Xbox", playstation: "PlayStation", steam: "Steam" };

function relativeAsOf(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function GameMasterySection({
  linkedSteamId,
  masteryScore,
  masteryXp,
  masteryLevel,
  masteryBreakdown,
  masteryComputedAt,
  onRecomputeMastery,
}) {
  const [recomputing, setRecomputing] = useState(false);

  async function handleRecompute() {
    setRecomputing(true);
    await onRecomputeMastery();
    setRecomputing(false);
  }

  const { xpIntoLevel, xpForNextLevel, progress } = levelFromXp(masteryXp || 0);
  const hasAnyData = (masteryBreakdown || []).length > 0;

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">Gaming Mastery</h2>
      <p className="settings-card__note">
        Your cross-platform Gamerscore equivalent, combining Steam, Xbox, and PlayStation.
      </p>

      {hasAnyData ? (
        <>
          <div className="backlog-summary">
            <div className="panel__stat">
              <span className="panel__stat-value">{Math.round(masteryScore)}</span>
              <span className="panel__stat-label">Gaming Mastery</span>
            </div>
            <div className="panel__stat">
              <span className="panel__stat-value">{masteryLevel}</span>
              <span className="panel__stat-label">Account Level</span>
            </div>
            <div className="panel__stat">
              <span className="panel__stat-value">{masteryXp.toLocaleString()}</span>
              <span className="panel__stat-label">Account XP</span>
            </div>
          </div>

          <div className="mastery-xp-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="mastery-xp-bar__fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <p className="settings-card__note">
            {xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP to level {masteryLevel + 1}
          </p>

          <div className="mastery-breakdown">
            {masteryBreakdown.map((entry) => (
              <div key={entry.platform} className="mastery-breakdown__row">
                <span className="mastery-breakdown__platform">{PLATFORM_LABELS[entry.platform] || entry.platform}</span>
                <span className="mastery-breakdown__score">{Math.round(entry.normalized).toLocaleString()}</span>
                <span className="mastery-breakdown__meta">
                  {entry.source === "live_steam_api" && `Live · ${entry.achievementsCounted} achievements across ${entry.gamesScanned} most-played games`}
                  {entry.source === "live_xbox_api" && `Live · ${entry.gamertag ? `${entry.gamertag} · ` : ""}${entry.gamerscore.toLocaleString()} Gamerscore`}
                  {entry.source === "live_psn_api" && `Live · real trophy counts via your linked PSN account`}
                  {entry.source === "self_reported" && `Self-reported${relativeAsOf(entry.asOf) ? ` · updated ${relativeAsOf(entry.asOf)}` : ""}`}
                </span>
              </div>
            ))}
          </div>

          {masteryComputedAt && (
            <p className="settings-card__note">Last computed {relativeAsOf(masteryComputedAt)}.</p>
          )}
        </>
      ) : (
        <p className="panel__status">
          No Mastery data yet — link Steam, Xbox, or PlayStation above, then recompute.
        </p>
      )}

      <button type="button" className="linking-row__connect" onClick={handleRecompute} disabled={recomputing}>
        {recomputing ? "Recomputing…" : "Recompute Gaming Mastery"}
      </button>

      {!linkedSteamId && (
        <p className="settings-card__note" style={{ marginTop: "12px" }}>
          Steam isn't linked — link it above to include your real achievement data here.
        </p>
      )}
    </div>
  );
}
