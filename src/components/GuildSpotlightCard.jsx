// Gaming dashboard — spotlights one of the user's real Guilds (the
// actual social-groups feature, guild_members/guild_activity — not to
// be confused with the 5 top-level Colleges). A person can be in zero,
// one, or many guilds with no "current guild" concept anywhere in the
// schema, so this picks whichever guild has the most recent real
// activity, falling back to the first membership if there's none yet.

import { useEffect, useState } from "react";
import {
  fetchMyGuilds,
  fetchGuildMembersWithProfiles,
  fetchRecentActivityForUser,
  fetchGuildActivity,
  describeActivity,
  displayName,
} from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";

const MEMBER_AVATAR_CAP = 4;

export default function GuildSpotlightCard({ userId, onOpenGuilds, embedded = false }) {
  const [guild, setGuild] = useState(null);
  const [members, setMembers] = useState([]);
  const [recentActivity, setRecentActivity] = useState(null);
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
        const [roster, activity] = await Promise.all([
          fetchGuildMembersWithProfiles(spotlight.id),
          fetchGuildActivity(spotlight.id, 1),
        ]);
        if (cancelled) return;
        setGuild(spotlight);
        setMembers(roster);
        setRecentActivity(activity[0] || null);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Guild Spotlight fetch failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [userId]);

  const memberCount = members.length;
  const previewMembers = members.slice(0, MEMBER_AVATAR_CAP);
  const overflowCount = Math.max(0, memberCount - MEMBER_AVATAR_CAP);

  const rootClass = embedded
    ? "guild-social-card__section guild-spotlight-card"
    : "panel hero-card guild-spotlight-card";

  return (
    <div className={rootClass}>
      <div className="panel__head">
        <span className="panel__eyebrow">Guild Spotlight</span>
      </div>

      {status === "loading" && <p className="panel__status">Loading your guild…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your guilds right now.</p>}

      {status === "empty" && (
        <div className="guild-spotlight__empty">
          <div className="guild-spotlight__empty-art" aria-hidden="true">
            <span className="guild-spotlight__empty-glyph">⚔</span>
          </div>
          <p className="guild-spotlight__empty-copy">Find your crew — join a Guild to share progress across every College.</p>
          <button type="button" className="guild-spotlight__cta" onClick={onOpenGuilds}>
            Browse Guilds
          </button>
        </div>
      )}

      {status === "ready" && guild && (
        <>
          <div className={`guild-spotlight__hero ${guild.banner_url ? "" : "guild-spotlight__hero--fallback"}`}>
            {guild.banner_url && (
              <img src={guild.banner_url} alt="" className="guild-spotlight__banner" decoding="async" />
            )}
            <div className="guild-spotlight__hero-shade" aria-hidden="true" />

            <div className="guild-spotlight__hero-content">
              <div className="guild-spotlight__logo-ring">
                {guild.logo_url ? (
                  <img src={guild.logo_url} alt="" className="guild-spotlight__logo" decoding="async" />
                ) : (
                  <span className="guild-spotlight__logo guild-spotlight__logo--fallback" aria-hidden="true">
                    {guild.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="guild-spotlight__identity">
                <h3 className="guild-spotlight__name">{guild.name}</h3>
                <div className="guild-spotlight__chips">
                  <span className="guild-spotlight__chip">
                    {memberCount} member{memberCount === 1 ? "" : "s"}
                  </span>
                  <span className={`guild-spotlight__chip guild-spotlight__chip--${guild.is_private ? "private" : "public"}`}>
                    {guild.is_private ? "Private" : "Public"}
                  </span>
                  {guild.is_official && (
                    <span className="guild-spotlight__chip guild-spotlight__chip--official">Official</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {guild.description && (
            <p className="guild-spotlight__description">{guild.description}</p>
          )}

          <div className="guild-spotlight__footer">
            {previewMembers.length > 0 && (
              <div className="guild-spotlight__roster" aria-label={`${memberCount} guild members`}>
                <div className="guild-spotlight__avatar-stack">
                  {previewMembers.map((member) => (
                    <MiniAvatar key={member.user_id} profile={member.profile} />
                  ))}
                </div>
                {overflowCount > 0 && (
                  <span className="guild-spotlight__roster-meta">+{overflowCount} more</span>
                )}
              </div>
            )}

            {recentActivity && (
              <div className="guild-spotlight__pulse">
                <MiniAvatar profile={recentActivity.profile} />
                <p className="guild-spotlight__pulse-copy">
                  <strong>{displayName(recentActivity.profile)}</strong>
                  {" "}
                  {describeActivity(recentActivity)}
                  <span className="guild-spotlight__pulse-time">
                    {" "}· {relativeTime(recentActivity.created_at)}
                  </span>
                </p>
              </div>
            )}

            <button type="button" className="guild-spotlight__cta" onClick={onOpenGuilds}>
              View Guild
              <span className="guild-spotlight__cta-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
