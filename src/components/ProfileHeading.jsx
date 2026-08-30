/**
 * Profile heading — dashboard identity strip.
 * Real Mastery Score when available; platform + stream links and tools on the right.
 */

import { useEffect, useState } from "react";
import { getProfileStreamQuickLinks } from "../lib/streamingProfiles";
import { QuickLinkRow } from "./CommunityQuickLinks";
import { MasteryRefreshButton, PlatformQuickLinks } from "./PlatformQuickLinks";

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
  userId,
  linkedSteamId,
  onGoToSettings,
  onGoToLinking,
  onRecomputeMastery,
  profileDetails,
}) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || username || (isLoggedIn ? "Player" : "Guest");
  const showHandle = username && username !== displayName;

  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  const profileStreamLinks = getProfileStreamQuickLinks(profileDetails);

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
          <span className="profile-heading__stat-label">Mastery Score</span>
        </div>
        {isLoggedIn && masteryScore > 0 && (
          <div className="profile-heading__stat" title="Cross-platform Gaming Mastery Score — see Account Linking for the breakdown">
            <span className="profile-heading__stat-value">{Math.round(masteryScore)}</span>
            <span className="profile-heading__stat-label">Gaming Mastery · Lvl {masteryLevel}</span>
          </div>
        )}
      </div>

      <div className="profile-heading__tools">
        {isLoggedIn && (
          <>
            <PlatformQuickLinks
              userId={userId}
              linkedSteamId={linkedSteamId}
              onGoToLinking={onGoToLinking}
              className="profile-heading__platform-links"
            />
            {profileStreamLinks.length > 0 && (
              <QuickLinkRow
                links={profileStreamLinks}
                className="profile-heading__stream-links"
                linkClassName="overview-platform-bar__link overview-platform-bar__link--stream overview-platform-bar__link--active"
                ariaLabel="Your streaming channels"
              />
            )}
            <MasteryRefreshButton
              linkedSteamId={linkedSteamId}
              onRecomputeMastery={onRecomputeMastery}
              className="overview-platform-bar__refresh profile-heading__refresh"
              showLabel={false}
            />
          </>
        )}
        {isLoggedIn && onGoToSettings && (
          <button type="button" className="profile-heading__tool" onClick={onGoToSettings}>
            Settings
          </button>
        )}
      </div>
    </section>
  );
}
