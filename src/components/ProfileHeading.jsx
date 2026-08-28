/**
 * Profile heading — dashboard identity strip.
 * Real GD Score + wishlist count when available; layout controls sit on the right.
 */

import { useEffect, useState } from "react";

function DefaultAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z" />
    </svg>
  );
}

export default function ProfileHeading({
  firstName,
  lastName,
  username,
  avatarUrl,
  gdScore = 0,
  masteryScore = 0,
  masteryLevel = 0,
  isLoggedIn,
  wishlistCount,
  onGoToSettings,
  onGoToLinking,
  customizingLayout,
  onToggleCustomize,
  onResetLayout,
}) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || username || (isLoggedIn ? "Player" : "Guest");
  const showHandle = username && username !== displayName;

  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  return (
    <section className="profile-heading">
      <div className="profile-heading__left">
        <div className="profile-heading__avatar">
          {avatarUrl && !avatarBroken ? (
            <img src={avatarUrl} alt="" decoding="async" onError={() => setAvatarBroken(true)} />
          ) : (
            <span className="profile-heading__avatar-default">
              <DefaultAvatarIcon />
            </span>
          )}
        </div>

        <div className="profile-heading__identity">
          <span className="profile-heading__name">{displayName}</span>
          {showHandle && <span className="profile-heading__handle">@{username}</span>}
          {!isLoggedIn && (
            <span className="profile-heading__hint">Sign in to sync across devices</span>
          )}
        </div>
      </div>

      <div className="profile-heading__stats">
        <div className="profile-heading__stat profile-heading__stat--primary">
          <span className="profile-heading__stat-value">
            {Number(gdScore || 0).toLocaleString()}
          </span>
          <span className="profile-heading__stat-label">GD Score</span>
        </div>
        {isLoggedIn && masteryScore > 0 && (
          <div className="profile-heading__stat" title="Cross-platform Gaming Mastery Score — see Account Linking for the breakdown">
            <span className="profile-heading__stat-value">{Math.round(masteryScore)}</span>
            <span className="profile-heading__stat-label">Gaming Mastery · Lvl {masteryLevel}</span>
          </div>
        )}
        {typeof wishlistCount === "number" && (
          <div className="profile-heading__stat">
            <span className="profile-heading__stat-value">{wishlistCount}</span>
            <span className="profile-heading__stat-label">Wishlist</span>
          </div>
        )}
      </div>

      <div className="profile-heading__tools">
        {onToggleCustomize && (
          <button
            type="button"
            className={`profile-heading__tool ${customizingLayout ? "is-active" : ""}`}
            onClick={onToggleCustomize}
          >
            {customizingLayout ? "Done" : "Customize layout"}
          </button>
        )}
        {customizingLayout && onResetLayout && (
          <button type="button" className="profile-heading__tool" onClick={onResetLayout}>
            Reset
          </button>
        )}
        {isLoggedIn && onGoToSettings && (
          <button type="button" className="profile-heading__tool" onClick={onGoToSettings}>
            Settings
          </button>
        )}
        {isLoggedIn && onGoToLinking && (
          <button type="button" className="profile-heading__tool" onClick={onGoToLinking}>
            Link accounts
          </button>
        )}
      </div>
    </section>
  );
}
