// Real friends + Guild activity on Overview — every name, avatar, and
// activity line comes straight from lib/friends.js (mutual, accepted
// friend connections) and lib/guilds.js's real guild_activity table
// (the same feed the header's notification bell already reads).
// Nothing here is a fabricated "online now" status — Lykodex has no
// real presence signal for friends beyond Steam (see
// SteamPresenceCard, which is self-only), so this deliberately shows
// what's actually knowable: who your real friends are, and what real
// things have happened in Guilds you're in.

import { useEffect, useState } from "react";
import { fetchFriends } from "../lib/friends";
import { fetchRecentActivityForUser, describeActivity } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";

function displayName(profile) {
  if (!profile) return "Someone";
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return full || profile.username || "Someone";
}

export default function FriendsActivityCard({ userId, onGoToFriends }) {
  const [friends, setFriends] = useState([]);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!userId) return;
    setStatus("loading");
    Promise.all([fetchFriends(userId), fetchRecentActivityForUser(userId, 4)])
      .then(([f, a]) => {
        setFriends(f);
        setActivity(a);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load friends/activity for Overview:", err);
        setStatus("error");
      });
  }, [userId]);

  if (status === "loading" || status === "error") return null;

  if (friends.length === 0 && activity.length === 0) {
    return (
      <div className="presence-card friends-activity-card friends-activity-card--empty">
        <span className="presence-card__title">Friends</span>
        <p className="presence-card__meta">No friends yet — add one with a real friend code.</p>
        <button type="button" className="quickdash-reset-btn" onClick={onGoToFriends}>
          Find friends
        </button>
      </div>
    );
  }

  return (
    <div className="presence-card friends-activity-card">
      <div className="friends-activity-card__head">
        <span className="presence-card__title">Friends</span>
        <button type="button" className="friends-activity-card__link" onClick={onGoToFriends}>
          See all →
        </button>
      </div>

      {friends.length > 0 && (
        <div className="friends-activity-card__avatars">
          {friends.slice(0, 10).map((f) => (
            <div key={f.friend_id} className="friends-activity-card__avatar" title={displayName(f.profile)}>
              {f.profile?.avatar_url ? (
                <img src={f.profile.avatar_url} alt="" />
              ) : (
                <span>{displayName(f.profile)[0]}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {activity.length > 0 ? (
        <ul className="friends-activity-card__list">
          {activity.map((entry) => (
            <li key={entry.id}>
              <span className="friends-activity-card__entry" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MiniAvatar profile={entry.profile} />
                {describeActivity(entry)}
              </span>
              <span className="presence-card__meta">
                {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="presence-card__meta">No recent Guild activity yet.</p>
      )}
    </div>
  );
}
