// Overview's "Guild Pulse" — the last 14 days of real Guild-mate
// activity (card adds, backlog changes, achievements unlocked,
// wishlist adds), one event per horizontal slide in SlidingBanner
// (same pattern as SteamPresenceCard on the Overview lane).

import { useEffect, useState } from "react";
import { fetchGuildPulse, describeActivity, collegeForPulseEvent, displayName } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";
import CollegeIcon from "./CollegeIcon";
import SlidingBanner from "./SlidingBanner";

function GuildPulseSlide({ entry }) {
  const college = collegeForPulseEvent(entry.event_type);
  const isCompletion = entry.event_type === "game_completed" || entry.event_type === "backlog_completed";

  return (
    <div className={`presence-card guild-pulse-slide ${isCompletion ? "guild-pulse-slide--special" : ""}`}>
      <MiniAvatar profile={entry.profile} />
      <div className="presence-card__body">
        <span className="presence-card__title">
          {isCompletion && <span aria-hidden="true">🏆 </span>}
          <strong>{displayName(entry.profile)}</strong> {describeActivity(entry)}
        </span>
        <span className="presence-card__meta">
          {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
          {relativeTime(entry.created_at)}
        </span>
      </div>
      {college && (
        <span className={`guild-pulse__chip guild-pulse__chip--${college}`}>
          <CollegeIcon collegeId={college} size={14} />
        </span>
      )}
    </div>
  );
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

  if (status === "loading") {
    return (
      <div className="presence-card presence-card--empty guild-pulse-slide">
        <p className="panel__status">Loading guild activity…</p>
      </div>
    );
  }

  if (status === "error") return null;

  if (!inGuild) {
    return (
      <div className="presence-card presence-card--empty guild-pulse-slide guild-pulse-slide--cta">
        <p className="panel__status">Join a Guild to see what your crew&apos;s been up to.</p>
        <button type="button" className="quickdash-reset-btn" onClick={onGoToGuilds}>
          Browse Guilds
        </button>
      </div>
    );
  }

  return (
    <SlidingBanner
      items={events}
      dotsLabel="Guild activity"
      getItemKey={(entry) => entry.id}
      emptyState={
        <div className="presence-card presence-card--empty guild-pulse-slide">
          <span className="presence-card__meta">Guild Pulse · 14 days</span>
          <p>Quiet the last two weeks — nothing new from your Guilds yet.</p>
        </div>
      }
      renderItem={(entry) => <GuildPulseSlide entry={entry} />}
    />
  );
}
