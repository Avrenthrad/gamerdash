// Guilds — real social groups of Lykodex users. Not the same as the 5
// top-level Colleges — a Guild is a small crew that cuts across all
// of them. Activity feed is built entirely from real, already-tracked
// data (see lib/guilds.js) — no invented per-game stats.

import { useEffect, useState } from "react";
import {
  fetchGuilds, createGuild, joinGuild, leaveGuild,
  fetchMyGuilds, fetchGuildMembers, fetchGuildActivity,
} from "../lib/guilds";

const EVENT_LABELS = {
  achievement_unlocked: "unlocked an achievement in",
  gd_score_milestone: "hit a new GD Score high",
  backlog_status_change: "updated their backlog:",
  wishlist_added: "added to their wishlist:",
  mtg_card_added: "added a card to their MTG collection:",
  joined_guild: "joined the guild",
};

function describeActivity(entry) {
  const label = EVENT_LABELS[entry.event_type] || entry.event_type;
  const detail = entry.event_data?.title || entry.event_data?.name || "";
  return `${label}${detail ? ` ${detail}` : ""}`;
}

export default function GuildsPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [allGuilds, setAllGuilds] = useState([]);
  const [myGuilds, setMyGuilds] = useState([]);
  const [status, setStatus] = useState("loading");
  const [newGuildName, setNewGuildName] = useState("");

  const [activeGuild, setActiveGuild] = useState(null);
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) {
      setStatus("ready");
      return;
    }
    loadGuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function loadGuilds() {
    setStatus("loading");
    try {
      const [all, mine] = await Promise.all([fetchGuilds(), fetchMyGuilds(userId)]);
      setAllGuilds(all);
      setMyGuilds(mine);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load guilds:", err);
      setStatus("error");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newGuildName.trim()) return;
    try {
      await createGuild(userId, newGuildName.trim());
      setNewGuildName("");
      loadGuilds();
    } catch (err) {
      console.error("Failed to create guild:", err);
    }
  }

  async function handleJoin(guildId) {
    try {
      await joinGuild(guildId, userId);
      loadGuilds();
    } catch (err) {
      console.error("Failed to join guild:", err);
    }
  }

  async function handleLeave(guildId) {
    try {
      await leaveGuild(guildId, userId);
      if (activeGuild?.id === guildId) setActiveGuild(null);
      loadGuilds();
    } catch (err) {
      console.error("Failed to leave guild:", err);
    }
  }

  async function openGuild(guild) {
    setActiveGuild(guild);
    try {
      const [membersData, activityData] = await Promise.all([
        fetchGuildMembers(guild.id),
        fetchGuildActivity(guild.id),
      ]);
      setMembers(membersData);
      setActivity(activityData);
    } catch (err) {
      console.error("Failed to load guild details:", err);
    }
  }

  const myGuildIds = new Set(myGuilds.map((g) => g.id));

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back</button>
          <h1 className="price-page__title">Guilds</h1>
          <p className="price-page__subtitle">Sign in to create or join a guild.</p>
        </div>
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  if (activeGuild) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={() => setActiveGuild(null)}>← Back to Guilds</button>
          <h1 className="price-page__title">{activeGuild.name}</h1>
          <p className="price-page__subtitle">{members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>

        {myGuildIds.has(activeGuild.id) && (
          <button type="button" className="quickdash-reset-btn" onClick={() => handleLeave(activeGuild.id)}>
            Leave guild
          </button>
        )}

        <div className="backlog-summary">
          <span className="feed-col__label">Activity feed</span>
        </div>
        {activity.length === 0 ? (
          <p className="panel__status">No activity yet — real activity from members will show up here.</p>
        ) : (
          <ul className="calendar-list">
            {activity.map((entry) => (
              <li key={entry.id} className="calendar-row">
                <span className="calendar-row__date">{new Date(entry.created_at).toLocaleDateString()}</span>
                <div className="calendar-row__body">
                  <span className="calendar-row__event">{describeActivity(entry)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Guilds</h1>
        <p className="price-page__subtitle">
          Real crews of Lykodex users — a shared feed of real achievements, backlog progress, and collection adds.
        </p>
      </div>

      <form className="price-search" onSubmit={handleCreate}>
        <input
          className="price-search__input"
          type="text"
          placeholder="New guild name…"
          value={newGuildName}
          onChange={(e) => setNewGuildName(e.target.value)}
        />
        <button type="submit" className="price-search__button">Create guild</button>
      </form>

      {status === "loading" && <p className="panel__status">Loading guilds…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load guilds right now.</p>}
      {status === "ready" && allGuilds.length === 0 && <p className="panel__status">No guilds yet — create the first one.</p>}

      {status === "ready" && allGuilds.length > 0 && (
        <ul className="backlog-list">
          {allGuilds.map((guild) => (
            <li key={guild.id} className="backlog-card">
              <div className="backlog-card__info">
                <span className="backlog-card__title">{guild.name}</span>
              </div>
              <button type="button" className="linking-row__connect" onClick={() => openGuild(guild)}>
                View
              </button>
              {!myGuildIds.has(guild.id) && (
                <button type="button" className="linking-row__connect" onClick={() => handleJoin(guild.id)}>
                  Join
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
