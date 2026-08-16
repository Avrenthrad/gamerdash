// Real "Now Playing" / last-online status from Steam's own
// GetPlayerSummaries endpoint (see lib/steam.js) — live, not cached,
// since presence goes stale almost immediately. Deliberately Steam-
// only: no party size, no competitive stats, nothing invented for
// platforms with no real presence API available to this app.

import { useEffect, useState } from "react";
import { fetchPlayerSummaries } from "../lib/steam";

// Real Steam personastate values (Steam Web API, ISteamUser/GetPlayerSummaries).
const PERSONA_STATE_LABELS = {
  0: "Offline",
  1: "Online",
  2: "Busy",
  3: "Away",
  4: "Snooze",
  5: "Looking to trade",
  6: "Looking to play",
};

function formatLastOnline(unixSeconds) {
  if (!unixSeconds) return null;
  const diffMs = Date.now() - unixSeconds * 1000;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SteamPresenceCard({ linkedSteamId }) {
  const [player, setPlayer] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!linkedSteamId) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    fetchPlayerSummaries([linkedSteamId])
      .then((players) => {
        setPlayer(players[0] || null);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load Steam presence:", err);
        setStatus("error");
      });
  }, [linkedSteamId]);

  if (!linkedSteamId) {
    return (
      <div className="presence-card presence-card--empty">
        <span className="presence-card__icon" aria-hidden="true">🎮</span>
        <p>Link Steam to see your real current status here.</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Checking Steam status…</p>
      </div>
    );
  }

  if (status === "error" || !player) {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Couldn't reach Steam's status right now.</p>
      </div>
    );
  }

  const inGame = Boolean(player.gameextrainfo);
  const isOnline = player.personastate > 0;
  const stateLabel = PERSONA_STATE_LABELS[player.personastate] ?? "Offline";
  const lastOnline = formatLastOnline(player.lastlogoff);

  return (
    <div className={`presence-card ${inGame ? "presence-card--playing" : ""}`}>
      <span
        className={`presence-card__dot presence-card__dot--${inGame ? "playing" : isOnline ? "online" : "offline"}`}
        aria-hidden="true"
      />
      <div className="presence-card__body">
        {inGame ? (
          <>
            <span className="presence-card__title">Playing {player.gameextrainfo}</span>
            <span className="presence-card__meta">via Steam · right now</span>
          </>
        ) : (
          <>
            <span className="presence-card__title">{stateLabel} on Steam</span>
            <span className="presence-card__meta">{lastOnline ? `Last online ${lastOnline}` : "No recent activity"}</span>
          </>
        )}
      </div>
    </div>
  );
}
