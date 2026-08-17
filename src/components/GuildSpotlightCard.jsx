// Gaming dashboard — spotlights one of the user's real Guilds (the
// actual social-groups feature, guild_members/guild_activity — not to
// be confused with the 5 top-level Colleges). A person can be in zero,
// one, or many guilds with no "current guild" concept anywhere in the
// schema, so this picks whichever guild has the most recent real
// activity, falling back to the first membership if there's none yet.

import { useEffect, useState } from "react";
import { fetchMyGuilds, fetchGuildMembers, fetchRecentActivityForUser } from "../lib/guilds";

export default function GuildSpotlightCard({ userId, onOpenGuilds }) {
  const [guild, setGuild] = useState(null);
  const [memberCount, setMemberCount] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setStatus("loading");

    Promise.all([fetchMyGuilds(userId), fetchRecentActivityForUser(userId, 1)])
      .then(async ([guilds, recent]) => {
        if (cancelled) return;
        if (guilds.length === 0) {
          setStatus("empty");
          return;
        }
        const spotlightId = recent[0]?.guild_id;
        const spotlight = guilds.find((g) => g.id === spotlightId) || guilds[0];
        const members = await fetchGuildMembers(spotlight.id);
        if (cancelled) return;
        setGuild(spotlight);
        setMemberCount(members.length);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Guild Spotlight fetch failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Guild Spotlight</span>
      </div>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your guilds right now.</p>}
      {status === "empty" && (
        <>
          <p className="panel__status">You haven't joined a Guild yet.</p>
          <button type="button" className="quickdash-reset-btn" onClick={onOpenGuilds}>Browse Guilds</button>
        </>
      )}

      {status === "ready" && guild && (
        <>
          <div className="guild-spotlight__identity">
            <div className="guild-spotlight__avatar" aria-hidden="true">
              {guild.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <span className="hero-card__title">{guild.name}</span>
              <span className="panel__status" style={{ margin: 0 }}>
                {memberCount} member{memberCount === 1 ? "" : "s"} · {guild.is_private ? "Private" : "Public"}
              </span>
            </div>
          </div>
          <button type="button" className="quickdash-reset-btn" onClick={onOpenGuilds}>View Guild</button>
        </>
      )}
    </div>
  );
}
