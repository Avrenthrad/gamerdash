// Gaming dashboard hero card — real Steam presence + real achievement
// completion. Not new data: fetchOwnProgress (lib/friendsData.js) is
// the same real, already-shipped function FriendSection's own-
// progress row used, just rendered here as a hero instead — see
// GamingDashboard.jsx for why that row was removed from FriendSection.

import { useEffect, useState } from "react";
import { fetchOwnProgress } from "../lib/friendsData";
import { steamHeaderArt } from "../lib/steam";

export default function ContinuePlayingCard({ linkedSteamId, onOpenLibrary }) {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!linkedSteamId) return;
    setStatus("loading");
    fetchOwnProgress(linkedSteamId)
      .then((result) => {
        setProgress(result);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Continue Playing fetch failed:", err);
        setStatus("error");
      });
  }, [linkedSteamId]);

  return (
    <div className="panel hero-card hero-card--continue-playing">
      <div className="panel__head">
        <span className="panel__eyebrow">Continue Playing</span>
      </div>

      {!linkedSteamId && (
        <p className="panel__status">Link Steam to see what you're playing here.</p>
      )}
      {linkedSteamId && status === "loading" && <p className="panel__status">Loading…</p>}
      {linkedSteamId && status === "error" && (
        <p className="panel__status panel__status--error">Couldn't load your progress right now.</p>
      )}
      {linkedSteamId && status === "ready" && !progress && (
        <p className="panel__status">No owned games visible on this Steam profile.</p>
      )}

      {linkedSteamId && status === "ready" && progress && (
        <button type="button" className="hero-card__art-btn" onClick={onOpenLibrary}>
          <img src={steamHeaderArt(progress.appid)} alt="" className="hero-card__art" />
          <div className="hero-card__art-overlay">
            <span className="hero-card__title">{progress.gameName}</span>
            {progress.isCurrentlyPlaying && (
              <span className="own-progress-row__live">● Playing now</span>
            )}
          </div>
        </button>
      )}

      {linkedSteamId && status === "ready" && progress && (
        <>
          {progress.completionPct != null && (
            <div className="friend-row__progress-bar">
              <div className="friend-row__progress-fill" style={{ width: `${progress.completionPct}%` }} />
            </div>
          )}
          <div className="panel__stat-row">
            {progress.completionPct != null && (
              <div className="panel__stat">
                <span className="panel__stat-value">{progress.completionPct}%</span>
                <span className="panel__stat-label">Achievements</span>
              </div>
            )}
            <div className="panel__stat">
              <span className="panel__stat-value">{progress.playtimeHours}h</span>
              <span className="panel__stat-label">Playtime</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
