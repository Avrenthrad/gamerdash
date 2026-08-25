// Collections — real Steam library.
//
// Honest about what Steam's API can and can't tell us: GetOwnedGames
// gives real playtime and ownership, but NOT install status (that's
// local-client-only info Valve doesn't expose over the web API) and
// NOT DLC ownership in any reliably-distinguishable way. So this shows
// what's actually real — game, platform, real playtime — rather than
// inventing "Installed"/"DLC" columns that would just be guesses.
// PSN/Xbox library data isn't available for the same reason personal
// achievement data isn't (see the Friends/Achievement decisions).

import { useEffect, useState } from "react";
import { fetchOwnedGames } from "../lib/steam";
import UnderConstructionOverlay from "./UnderConstructionOverlay";
import { AccountGatePanel } from "./AccountGate";

export default function LibrarySection({ isLoggedIn, onSignIn, onCreateAccount, linkedSteamId, onGoToLinking, onGoToBacklog, onGoToLibrary }) {
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

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
  }, [linkedSteamId]);

  return (
    <section id="library" className="panel panel--rose">
      {(!isLoggedIn || !linkedSteamId) && <UnderConstructionOverlay />}
      <div className="panel__head">
        <h2 className="panel__title">Collections</h2>
        <p className="panel__subtitle">Your real Steam library, sorted by playtime.</p>
      </div>

      {isLoggedIn && (
        <button type="button" className="steam-sync-link backlog-nav-link" onClick={onGoToBacklog}>
          View your Backlog / To Be Played →
        </button>
      )}
      {isLoggedIn && linkedSteamId && onGoToLibrary && (
        <button type="button" className="steam-sync-link backlog-nav-link" onClick={onGoToLibrary}>
          View full Library →
        </button>
      )}

      {!isLoggedIn && (
        <AccountGatePanel
          message="Sign in to see your game library."
          onSignIn={onSignIn}
          onCreateAccount={onCreateAccount}
        />
      )}

      {isLoggedIn && !linkedSteamId && (
        <p className="panel__status">
          No Steam account linked yet —{" "}
          <button type="button" className="steam-sync-link" onClick={onGoToLinking}>
            link one on Account Linking
          </button>{" "}
          to see your library.
        </p>
      )}

      {isLoggedIn && linkedSteamId && status === "loading" && (
        <p className="panel__status">Loading your library…</p>
      )}
      {isLoggedIn && linkedSteamId && status === "error" && (
        <p className="panel__status panel__status--error">Couldn't load your library right now.</p>
      )}
      {isLoggedIn && linkedSteamId && status === "ready" && games.length === 0 && (
        <p className="panel__status">No games found on this Steam profile — is it set to public?</p>
      )}

      {isLoggedIn && linkedSteamId && status === "ready" && games.length > 0 && (
        <table className="library-table">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">Platform</th>
              <th scope="col">Playtime</th>
            </tr>
          </thead>
          <tbody>
            {games.slice(0, 10).map((g) => (
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
                <td>Steam</td>
                <td>{Math.round((g.playtime_forever || 0) / 60)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isLoggedIn && linkedSteamId && status === "ready" && games.length > 10 && (
        <p className="panel__status">Showing your top 10 most-played of {games.length} games.</p>
      )}
    </section>
  );
}
