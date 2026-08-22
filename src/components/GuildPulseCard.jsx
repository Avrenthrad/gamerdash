// Overview's "Guild Pulse" — the last 14 days of real Guild-mate
// activity (card adds, backlog changes, achievements unlocked,
// wishlist adds), all already flowing through lib/guilds.js's existing
// activity system (see fetchGuildPulse). Privacy is enforced server-side
// by guild_activity's own RLS policy, not here — whatever this
// component receives has already had opted-out members' rows removed
// before it ever left the database, so there's no filtering to do on
// this end.

import { useEffect, useState } from "react";
import { fetchGuildPulse, describeActivity, collegeForPulseEvent } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";
import CollegeIcon from "./CollegeIcon";

function displayName(profile) {
  if (!profile) return "Someone";
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return full || profile.username || "Someone";
}

export default function GuildPulseCard({ userId, onGoToGuilds }) {
  const [status, setStatus] = useState("loading");
  const [inGuild, setInGuild] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!userId) return;
    setStatus("loading");
    fetchGuildPulse(userId, 14)
      .then((result) => {
        setInGuild(result.inGuild);
        setEvents(result.events);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Guild Pulse fetch failed:", err);
        setStatus("error");
      });
  }, [userId]);

  if (status === "loading" || status === "error") return null;

  return (
    <div className="panel guild-pulse">
      <div className="panel__head">
        <span className="panel__eyebrow">Guild Pulse · 14 days</span>
      </div>

      {!inGuild && (
        <div className="guild-pulse__empty">
          <p className="panel__status">Join a Guild to see what your crew's been up to.</p>
          <button type="button" className="quickdash-reset-btn" onClick={onGoToGuilds}>
            Browse Guilds
          </button>
        </div>
      )}

      {inGuild && events.length === 0 && (
        <p className="panel__status">Quiet the last two weeks — nothing new from your Guilds yet.</p>
      )}

      {inGuild && events.length > 0 && (
        <ul className="guild-pulse__list">
          {events.map((entry) => {
            const college = collegeForPulseEvent(entry.event_type);
            return (
              <li key={entry.id} className="guild-pulse__row">
                <MiniAvatar profile={entry.profile} />
                <div className="guild-pulse__row-body">
                  <span className="guild-pulse__row-text">
                    <strong>{displayName(entry.profile)}</strong> {describeActivity(entry)}
                  </span>
                  <span className="guild-pulse__row-meta">
                    {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
                    {relativeTime(entry.created_at)}
                  </span>
                </div>
                {college && (
                  <span className={`guild-pulse__chip guild-pulse__chip--${college}`}>
                    <CollegeIcon collegeId={college} size={14} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
