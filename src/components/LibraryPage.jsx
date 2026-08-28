// Library — the real, dedicated version of Collections. Applies the
// stat-card visual language from a recent design pass, but only with
// data Lykodex actually has.
//
// Deliberately does NOT include some things a mockup for this page
// showed: a whole-library completion split — our real Backlog system
// only tracks status for games someone explicitly added, not
// automatically for an entire library; and "last played X days ago"
// timestamps — confirmed via Steam's own community forums that the
// field this would need (rtime_last_played) only populates when
// querying with the account owner's own personal API key, not the
// shared server key this project uses for every account. "Most
// Played," sorted by real playtime, is the honest version of that
// same idea.
//
// Xbox/PlayStation DO get a real per-game playtime section now — not
// self-reported, and not a scrape (both were confirmed to have no
// public API for this at all, see AccountLinkingPage.jsx). It's real
// data the Discord presence bot has actually observed: whenever a
// linked friend's Discord Rich Presence shows them playing something
// on Xbox/PlayStation, the bot accumulates minutes per game into
// platform_playtime (see /discord-bot, lib/crossPlatformActivity.js).
// That means it's honestly partial — only covers time played since
// Discord was linked and while Rich Presence was visible, not a full
// historical library — and the UI says so, rather than presenting it
// as equivalent to Steam's complete server-side playtime record.

import { useEffect, useState } from "react";
import { fetchOwnedGames, steamHeaderArt } from "../lib/steam";
import { fetchBacklog } from "../lib/backlog";
import { fetchPlatformPlaytime } from "../lib/crossPlatformActivity";
import UnderConstructionOverlay from "./UnderConstructionOverlay";
import { AccountGatePanel } from "./AccountGate";

const PLATFORM_LABELS = { xbox: "Xbox", playstation: "PlayStation" };

function PlatformTag({ platform }) {
  const label = platform === "steam" ? "Steam" : PLATFORM_LABELS[platform] || platform;
  return <span className={`tag tag--platform tag--platform-${platform}`}>{label}</span>;
}

export default function LibraryPage({
  onBack, isLoggedIn, onSignIn, onCreateAccount, userId,
  linkedSteamId, onGoToLinking, onGoToBacklog, gdScore,
}) {
  const [games, setGames] = useState([]);
  const [backlogCount, setBacklogCount] = useState(null);
  const [status, setStatus] = useState("idle");
  const [otherPlatformGames, setOtherPlatformGames] = useState([]);

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

  useEffect(() => {
    if (!userId) return;
    fetchPlatformPlaytime(userId)
      .then((rows) => {
        const sorted = [...rows]
          .filter((r) => r.platform === "xbox" || r.platform === "playstation")
          .sort((a, b) => (b.total_minutes || 0) - (a.total_minutes || 0));
        setOtherPlatformGames(sorted);
      })
      .catch((err) => console.error("Cross-platform playtime fetch failed:", err));
  }, [userId]);

  const totalGames = games.length;
  const steamPlaytimeHours = Math.round(games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60);
  const xboxPlaytimeHours = Math.round(
    otherPlatformGames.filter((r) => r.platform === "xbox").reduce((sum, r) => sum + (r.total_minutes || 0), 0) / 60
  );
  const playstationPlaytimeHours = Math.round(
    otherPlatformGames.filter((r) => r.platform === "playstation").reduce((sum, r) => sum + (r.total_minutes || 0), 0) / 60
  );
  const totalPlaytimeHours = steamPlaytimeHours + xboxPlaytimeHours + playstationPlaytimeHours;

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
            {(xboxPlaytimeHours > 0 || playstationPlaytimeHours > 0) && (
              <span className="panel__stat-sub">
                {steamPlaytimeHours.toLocaleString()}h Steam
                {xboxPlaytimeHours > 0 ? ` · ${xboxPlaytimeHours.toLocaleString()}h Xbox` : ""}
                {playstationPlaytimeHours > 0 ? ` · ${playstationPlaytimeHours.toLocaleString()}h PlayStation` : ""}
              </span>
            )}
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
                    decoding="async"
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
                    <span className="backlog-card__meta">
                      <PlatformTag platform="steam" /> {Math.round((g.playtime_forever || 0) / 60)}h played
                    </span>
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
                    <th scope="col">Platform</th>
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
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          {g.name}
                        </div>
                      </td>
                      <td><PlatformTag platform="steam" /></td>
                      <td>{Math.round((g.playtime_forever || 0) / 60)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {isLoggedIn && otherPlatformGames.length > 0 && (
        <div className="library-most-played" style={{ marginTop: "24px" }}>
          <span className="feed-col__label">Xbox &amp; PlayStation</span>
          <p className="panel__status" style={{ fontSize: "11px", marginBottom: "10px" }}>
            Tracked since you linked Discord — not your full historical library.
          </p>
          <ul className="backlog-list">
            {otherPlatformGames.map((g) => (
              <li key={`${g.platform}-${g.game_name}`} className="backlog-card">
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{g.game_name}</span>
                  <span className="backlog-card__meta">
                    <PlatformTag platform={g.platform} /> {Math.round((g.total_minutes || 0) / 60)}h played
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
