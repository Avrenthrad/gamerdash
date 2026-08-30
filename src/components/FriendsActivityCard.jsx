// Real friends + Guild activity on Overview — every name, avatar, and
// activity line comes straight from lib/friends.js (mutual, accepted
// friend connections) and lib/guilds.js's real guild_activity table
// (the same feed the header's notification bell already reads).
// Nothing here is a fabricated "online now" status — Lykodex has no
// real presence signal for friends beyond Steam (see
// SteamPresenceCard, which is self-only), so this deliberately shows
// what's actually knowable: who your real friends are, and what real
// things have happened in Guilds you're in.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchFriends } from "../lib/friends";
import { fetchRecentActivityForUser, describeActivity, displayName } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";

const HOLD_MS = 3600;
const FADE_MS = 380;
const MAX_FRIENDS = 10;

function FriendStatusSlide({ friend, latest }) {
  const name = displayName(friend.profile);

  if (!latest) {
    return (
      <div className="friends-activity-card__status">
        <span className="friends-activity-card__status-name">{name}</span>
        <span className="friends-activity-card__status-meta">No recent Guild activity yet.</span>
      </div>
    );
  }

  return (
    <div className="friends-activity-card__status">
      <span className="friends-activity-card__status-line">
        <strong>{name}</strong> {describeActivity(latest)}
      </span>
      <span className="friends-activity-card__status-meta">
        {latest.guilds?.name ? `${latest.guilds.name} · ` : ""}
        {relativeTime(latest.created_at)}
      </span>
    </div>
  );
}

export default function FriendsActivityCard({ userId, onGoToFriends }) {
  const [friends, setFriends] = useState([]);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState("loading");
  const [index, setIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const tabsRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 32 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setStatus("loading");
    Promise.all([fetchFriends(userId), fetchRecentActivityForUser(userId, 20)])
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

  const slides = friends.slice(0, MAX_FRIENDS).map((friend) => ({
    friend,
    latest: activity.find((entry) => entry.user_id === friend.friend_id) || null,
  }));

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (reducedMotion || paused || slides.length < 2) return;
    if (!fadeOut) {
      const t = setTimeout(() => setFadeOut(true), HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadeOut, reducedMotion, paused, slides.length]);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const active = tabs.children[index];
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [index, slides.length, friends.length]);

  if (status === "loading") {
    return (
      <div className="presence-card friends-activity-card">
        <span className="presence-card__title">Friends</span>
        <p className="presence-card__meta">Loading…</p>
      </div>
    );
  }

  if (status === "error") return null;

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

  const current = slides[index] || slides[0];

  return (
    <div
      className="presence-card friends-activity-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="friends-activity-card__head">
        <span className="presence-card__title">Friends</span>
        <button type="button" className="friends-activity-card__link" onClick={onGoToFriends}>
          See all →
        </button>
      </div>

      {slides.length > 0 && (
        <>
          <div className="friends-activity-card__tabs-wrap">
            <div className="friends-activity-card__tabs" ref={tabsRef} role="tablist" aria-label="Friends">
              <span
                className="friends-activity-card__tab-indicator"
                aria-hidden="true"
                style={{
                  width: `${indicator.width}px`,
                  transform: `translateX(${indicator.left}px)`,
                }}
              />
              {slides.map((slide, i) => {
                const name = displayName(slide.friend.profile);
                const initial = name[0] || "?";
                return (
                  <button
                    key={slide.friend.friend_id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={name}
                    className={`friends-activity-card__tab ${i === index ? "friends-activity-card__tab--active" : ""}`}
                    onClick={() => {
                      setIndex(i);
                      setFadeOut(false);
                    }}
                  >
                    {slide.friend.profile?.avatar_url ? (
                      <img src={slide.friend.profile.avatar_url} alt="" decoding="async" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="friends-activity-card__status-pane">
            <div className={`friends-activity-card__status-slide ${fadeOut ? "friends-activity-card__status-slide--out" : ""}`}>
              {current && <FriendStatusSlide friend={current.friend} latest={current.latest} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
