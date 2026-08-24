// Gaming dashboard — real Guild activity feed. Same functions the
// header notification bell already uses (fetchRecentActivityForUser +
// describeActivity, lib/guilds.js), just a smaller, page-embedded list
// instead of a dropdown.

import { useEffect, useState } from "react";
import { fetchRecentActivityForUser, describeActivity, displayName } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";

export default function RecentActivityCard({ userId, onOpenGuilds }) {
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setStatus("loading");
    fetchRecentActivityForUser(userId, 4)
      .then((rows) => {
        if (cancelled) return;
        setActivity(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Recent Activity fetch failed:", err);
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Recent Activity</span>
        <button type="button" className="linkish" onClick={onOpenGuilds}>View all →</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load recent activity right now.</p>}
      {status === "ready" && activity.length === 0 && (
        <p className="panel__status">Nothing yet — join a Guild to see real activity here.</p>
      )}

      {status === "ready" && activity.length > 0 && (
        <ul className="activity-feed-list">
          {activity.map((entry) => (
            <li key={entry.id} className="activity-feed-row">
              <span className="activity-feed-row__text" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MiniAvatar profile={entry.profile} />
                <strong>{displayName(entry.profile)}</strong> {describeActivity(entry)}
              </span>
              <span className="activity-feed-row__meta">
                {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
