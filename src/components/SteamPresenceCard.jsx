// Real "Now Playing" / last-online status for you + your Steam-linked
// friends, one at a time in a horizontal sliding banner — see
// lib/steam.js's fetchPlayerSummaries (live, not cached) and
// lib/friends.js's fetchFriendsSteamIds (friend-scoped RPC, never
// exposes a non-friend's linked account). Deliberately Steam-only.

import { useEffect, useState } from "react";
import { fetchPlayerSummaries } from "../lib/steam";
import { fetchFriends, fetchFriendsSteamIds } from "../lib/friends";
import SlidingBanner from "./SlidingBanner";
import MiniAvatar from "./MiniAvatar";

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

function displayName(profile, player, isSelf) {
  if (isSelf) return "You";
  const fromProfile = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  return fromProfile || profile?.username || player?.personaname || "A friend";
}

function presenceRank(entry) {
  const player = entry.player;
  if (!player) return 3;
  if (player.gameextrainfo) return 0;
  if (player.personastate > 0) return 1;
  return 2;
}

function PresenceSlide({ entry }) {
  const { profile, player, isSelf } = entry;
  const inGame = Boolean(player.gameextrainfo);
  const isOnline = player.personastate > 0;
  const stateLabel = PERSONA_STATE_LABELS[player.personastate] ?? "Offline";
  const lastOnline = formatLastOnline(player.lastlogoff);
  const name = displayName(profile, player, isSelf);

  return (
    <div className={`presence-card ${inGame ? "presence-card--playing" : ""}`}>
      {profile ? (
        <MiniAvatar profile={profile} />
      ) : (
        <img src={player.avatarfull} alt="" className="presence-card__steam-avatar" decoding="async" />
      )}
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
            <span className="presence-card__title">
              {name} · {stateLabel} on Steam
            </span>
            <span className="presence-card__meta">{lastOnline ? `Last online ${lastOnline}` : "No recent activity"}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function SteamPresenceCard({ userId, linkedSteamId }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    setStatus("loading");

    (async () => {
      const slides = [];

      if (linkedSteamId) {
        const selfPlayers = await fetchPlayerSummaries([linkedSteamId]);
        const self = selfPlayers[0];
        if (self) slides.push({ id: `self-${linkedSteamId}`, profile: null, player: self, isSelf: true });
      }

      const friends = await fetchFriends(userId);
      const friendIds = friends.map((f) => f.friend_id);
      const steamLinks = await fetchFriendsSteamIds(friendIds);

      if (steamLinks.length > 0) {
        const steamIdByFriendId = new Map(steamLinks.map((l) => [l.id, l.linked_steam_id]));
        const players = await fetchPlayerSummaries(steamLinks.map((l) => l.linked_steam_id));
        const playerBySteamId = new Map(players.map((p) => [p.steamid, p]));

        for (const friend of friends) {
          const steamId = steamIdByFriendId.get(friend.friend_id);
          if (!steamId) continue;
          const player = playerBySteamId.get(steamId);
          if (!player) continue;
          slides.push({
            id: `friend-${friend.friend_id}`,
            profile: friend.profile,
            player,
            isSelf: false,
          });
        }
      }

      slides.sort((a, b) => presenceRank(a) - presenceRank(b));
      return slides;
    })()
      .then((result) => {
        setEntries(result);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load friends' Steam presence:", err);
        setStatus("error");
      });
  }, [userId, linkedSteamId]);

  if (!userId || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Checking Steam status…</p>
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
      getItemKey={(entry) => entry.id}
      emptyState={
        <div className="presence-card presence-card--empty">
          <span className="presence-card__icon" aria-hidden="true">
            🎮
          </span>
          <p>Link Steam to see live status here — yours and your friends'.</p>
        </div>
      }
      renderItem={(entry) => <PresenceSlide entry={entry} />}
    />
  );
}
