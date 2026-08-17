// Library — the real, dedicated version of Collections. Applies the
// stat-card visual language from a recent design pass, but only with
// data Lykodex actually has.
//
// Deliberately does NOT include some things a mockup for this page
// showed: a per-platform ownership breakdown (PlayStation/Xbox/PC
// counts) — no real data source exists for that, most owned games
// only have real data via Steam; a whole-library completion split —
// our real Backlog system only tracks status for games someone
// explicitly added, not automatically for an entire library; and
// "last played X days ago" timestamps — confirmed via Steam's own
// community forums that the field this would need (rtime_last_played)
// only populates when querying with the account owner's own personal
// API key, not the shared server key this project uses for every
// account. "Most Played," sorted by real playtime, is the honest
// version of that same idea.

import { useEffect, useState } from "react";
import { fetchOwnedGames, steamHeaderArt } from "../lib/steam";
import { fetchBacklog } from "../lib/backlog";
import UnderConstructionOverlay from "./UnderConstructionOverlay";
import { AccountGatePanel } from "./AccountGate";

export default function LibraryPage({
  onBack, isLoggedIn, onSignIn, onCreateAccount, userId,
  linkedSteamId, onGoToLinking, onGoToBacklog, gdScore,
}) {
  const [games, setGames] = useState([]);
  const [backlogCount, setBacklogCount] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!linkedSteamId) return;
    setStatus("loading");

    fetchOwnedGames(linkedSteamId)
      .then((list) => {
        const sorted = [...list].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
        setGames(sorted);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Library fetch failed:", err);
        setStatus("error");
      });

    if (userId) {
      fetchBacklog(userId)
        .then((rows) => setBacklogCount(rows.length))
        .catch((err) => {
          console.error("Backlog count fetch failed:", err);
          setBacklogCount(null);
        });
    }
  }, [linkedSteamId, userId]);

  const totalGames = games.length;
  const totalPlaytimeHours = Math.round(games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Library</h1>
        <p className="price-page__subtitle">Your real Steam library, real playtime, sorted honestly.</p>
      </div>

      {(!isLoggedIn || !linkedSteamId) && <UnderConstructionOverlay />}

      {!isLoggedIn && (
        <AccountGatePanel message="Sign in to see your game library." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
      )}

      {isLoggedIn && !linkedSteamId && (
        <p className="panel__status">
          No Steam account linked yet —{" "}
          <button type="button" className="steam-sync-link" onClick={onGoToLinking}>link one on Account Linking</button>{" "}
          to see your library.
        </p>
      )}

      {isLoggedIn && linkedSteamId && status === "ready" && (
        <div className="backlog-summary">
          <div className="panel__stat">
            <span className="panel__stat-value">{totalGames}</span>
            <span className="panel__stat-label">Games</span>
          </div>
          <div className="panel__stat">
            <span className="panel__stat-value">{totalPlaytimeHours.toLocaleString()}h</span>
            <span className="panel__stat-label">Total playtime</span>
          </div>
          {backlogCount != null && (
            <div className="panel__stat">
              <span className="panel__stat-value">{backlogCount}</span>
              <span className="panel__stat-label">In Backlog</span>
            </div>
          )}
          <div className="panel__stat">
            <span className="panel__stat-value">{gdScore?.toLocaleString() ?? 0}</span>
            <span className="panel__stat-label">GD Score</span>
          </div>
        </div>
      )}

      {isLoggedIn && (
        <button type="button" className="quickdash-reset-btn" onClick={onGoToBacklog} style={{ marginTop: "16px" }}>
          View your Backlog / To Be Played →
        </button>
      )}

      {isLoggedIn && linkedSteamId && status === "loading" && <p className="panel__status">Loading your library…</p>}
      {isLoggedIn && linkedSteamId && status === "error" && <p className="panel__status panel__status--error">Couldn't load your library right now.</p>}
      {isLoggedIn && linkedSteamId && status === "ready" && games.length === 0 && (
        <p className="panel__status">No games found on this Steam profile — is it set to public?</p>
      )}

      {isLoggedIn && linkedSteamId && status === "ready" && games.length > 0 && (
        <>
          <div className="library-most-played">
            <span className="feed-col__label">Most Played</span>
            <ul className="backlog-list">
              {games.slice(0, 6).map((g) => (
                <li key={g.appid} className="backlog-card">
                  <img
                    src={steamHeaderArt(g.appid)}
                    alt=""
                    className="backlog-card__thumb"
                    onError={(e) => {
                      e.target.onerror = null;
                      if (g.img_icon_url) {
                        e.target.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`;
                      } else {
                        e.target.style.display = "none";
                      }
                    }}
                  />
                  <div className="backlog-card__info">
                    <span className="backlog-card__title">{g.name}</span>
                    <span className="backlog-card__meta">{Math.round((g.playtime_forever || 0) / 60)}h played</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {games.length > 6 && (
            <>
              <span className="feed-col__label" style={{ marginTop: "24px", display: "block" }}>Full Library ({games.length})</span>
              <table className="library-table">
                <thead>
                  <tr>
                    <th scope="col">Game</th>
                    <th scope="col">Playtime</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.appid}>
                      <td>
                        <div className="library-table__game">
                          {g.img_icon_url && (
                            <img
                              src={`https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`}
                              alt=""
                              className="library-table__icon"
                            />
                          )}
                          {g.name}
                        </div>
                      </td>
                      <td>{Math.round((g.playtime_forever || 0) / 60)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
