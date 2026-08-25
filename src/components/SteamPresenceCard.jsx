// Real "Now Playing" / last-online status for your FRIENDS, one at a
// time in a rotating banner — see lib/steam.js's fetchPlayerSummaries
// (live, not cached) and lib/friends.js's fetchFriendsSteamIds
// (friend-scoped RPC, never exposes a non-friend's linked account).
// Deliberately Steam-only: no party size, no competitive stats,
// nothing invented for platforms with no real presence API here.
//
// This used to show only YOUR OWN Steam status — moved to
// FriendsActivityCard's neighborhood conceptually, but kept as its
// own component/file since the rendering (presence dot, playing/last
// online copy) is unrelated to that card's guild-activity feed.

import { useEffect, useState } from "react";
import { fetchPlayerSummaries } from "../lib/steam";
import { fetchFriends, fetchFriendsSteamIds } from "../lib/friends";
import SlidingBanner from "./SlidingBanner";
import MiniAvatar from "./MiniAvatar";

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

export default function SteamPresenceCard({ userId }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    setStatus("loading");

    fetchFriends(userId)
      .then(async (friends) => {
        const friendIds = friends.map((f) => f.friend_id);
        const steamLinks = await fetchFriendsSteamIds(friendIds);
        if (steamLinks.length === 0) return [];

        const steamIdByFriendId = new Map(steamLinks.map((l) => [l.id, l.linked_steam_id]));
        const players = await fetchPlayerSummaries(steamLinks.map((l) => l.linked_steam_id));
        const playerBySteamId = new Map(players.map((p) => [p.steamid, p]));

        return friends
          .filter((f) => steamIdByFriendId.has(f.friend_id))
          .map((f) => ({ profile: f.profile, player: playerBySteamId.get(steamIdByFriendId.get(f.friend_id)) }))
          .filter((entry) => entry.player);
      })
      .then((result) => {
        setEntries(result);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load friends' Steam presence:", err);
        setStatus("error");
      });
  }, [userId]);

  if (!userId || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Checking friends' Steam status…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Couldn't reach Steam's status right now.</p>
      </div>
    );
  }

  return (
    <SlidingBanner
      items={entries}
      emptyState={
        <div className="presence-card presence-card--empty">
          <span className="presence-card__icon" aria-hidden="true">🎮</span>
          <p>No friends with Steam linked yet.</p>
        </div>
      }
      renderItem={({ profile, player }) => {
        const inGame = Boolean(player.gameextrainfo);
        const isOnline = player.personastate > 0;
        const stateLabel = PERSONA_STATE_LABELS[player.personastate] ?? "Offline";
        const lastOnline = formatLastOnline(player.lastlogoff);
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "A friend";

        return (
          <div className={`presence-card ${inGame ? "presence-card--playing" : ""}`}>
            <MiniAvatar profile={profile} />
            <span
              className={`presence-card__dot presence-card__dot--${inGame ? "playing" : isOnline ? "online" : "offline"}`}
              aria-hidden="true"
            />
            <div className="presence-card__body">
              {inGame ? (
                <>
                  <span className="presence-card__title">{name} · Playing {player.gameextrainfo}</span>
                  <span className="presence-card__meta">via Steam · right now</span>
                </>
              ) : (
                <>
                  <span className="presence-card__title">{name} · {stateLabel} on Steam</span>
                  <span className="presence-card__meta">{lastOnline ? `Last online ${lastOnline}` : "No recent activity"}</span>
                </>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
