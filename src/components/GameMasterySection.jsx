// Game Mastery Score — cross-platform "Gamerscore equivalent" section
// of Account Linking. Steam and Xbox are both fully live now (real
// unlocked achievements / real Gamerscore via Xbox Live sign-in — see
// lib/gameMasteryData.js). PlayStation trophy counts are still
// self-reported here — real live PSN trophy sync exists (PsnCard in
// AccountLinkingPage.jsx) and wins automatically when linked, but this
// manual entry stays as the honest fallback for anyone who doesn't
// want to link.

import { useEffect, useState } from "react";
import {
  fetchMasteryInputs, savePsTrophyCounts,
} from "../lib/gameMasteryData";
import { PS_TROPHY_TIERS, PS_TROPHY_TIER_POINTS, levelFromXp } from "../lib/gameMastery";

const TIER_LABELS = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" };
const PLATFORM_LABELS = { xbox: "Xbox", playstation: "PlayStation", steam: "Steam" };

function emptyCounts() {
  const counts = {};
  PS_TROPHY_TIERS.forEach((tier) => { counts[tier] = ""; });
  return counts;
}

function relativeAsOf(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function GameMasterySection({
  userId,
  linkedSteamId,
  masteryScore,
  masteryXp,
  masteryLevel,
  masteryBreakdown,
  masteryComputedAt,
  onRecomputeMastery,
}) {
  const [psCounts, setPsCounts] = useState(emptyCounts());
  const [psStatus, setPsStatus] = useState("idle");
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchMasteryInputs(userId)
      .then((inputs) => {
        if (!inputs) return;
        if (inputs.ps_trophy_counts) {
          const counts = emptyCounts();
          PS_TROPHY_TIERS.forEach((tier) => {
            // Only a plain number is the current (post-rarity-removal)
            // shape — an older nested { rarity: count } object from
            // before this change is silently skipped rather than
            // rendered as "[object Object]", since there's no honest
            // way to collapse rarity-weighted sub-counts back into a
            // single tier count without asking the person to re-enter.
            const v = inputs.ps_trophy_counts?.[tier];
            if (typeof v === "number") counts[tier] = String(v);
          });
          setPsCounts(counts);
        }
      })
      .catch((err) => console.error("Failed to load Game Mastery inputs:", err));
  }, [userId]);

  async function handleSavePs(e) {
    e.preventDefault();
    setPsStatus("saving");
    const counts = {};
    PS_TROPHY_TIERS.forEach((tier) => {
      counts[tier] = Math.max(0, Number(psCounts[tier]) || 0);
    });
    try {
      await savePsTrophyCounts(userId, counts);
      await onRecomputeMastery();
      setPsStatus("saved");
    } catch (err) {
      console.error("Failed to save PlayStation trophy counts:", err);
      setPsStatus("error");
    }
  }

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
          No Mastery data yet — link Steam/Xbox/PlayStation above, or enter PlayStation trophies below, then recompute.
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

      <details style={{ marginTop: "14px" }}>
        <summary className="panel__status" style={{ cursor: "pointer" }}>Enter PlayStation trophies</summary>
        <p className="panel__status" style={{ fontSize: "11px" }}>
          Read these straight off your own PSN trophy case — just the count per tier, no rarity breakdown needed.
        </p>
        <div className="mastery-ps-grid">
          {PS_TROPHY_TIERS.map((tier) => (
            <div key={tier} className="mastery-ps-grid__row">
              <span>{TIER_LABELS[tier]} ({PS_TROPHY_TIER_POINTS[tier]}pt each)</span>
              <input
                type="number"
                min="0"
                value={psCounts[tier]}
                onChange={(e) => setPsCounts((prev) => ({ ...prev, [tier]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button type="button" className="price-search__button" onClick={handleSavePs} disabled={psStatus === "saving"} style={{ marginTop: "8px" }}>
          {psStatus === "saving" ? "Saving…" : "Save trophy counts"}
        </button>
        {psStatus === "error" && <p className="panel__status panel__status--error">Couldn't save — try again.</p>}
      </details>
    </div>
  );
}
