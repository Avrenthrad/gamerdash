// Gaming College's own internal dashboard (view === "dashboard").
// Extracted out of App.jsx once this view grew a real hero section —
// see the plan notes for the redesign this came out of. Every widget
// here is backed by a real Lykodex data source (see each card
// component's own header comment for where its data comes from); no
// invented ranks/reputation/missions/combat stats.

import ProfileHeading from "./ProfileHeading";
import SteamPresenceCard from "./SteamPresenceCard";
import GamingPresenceCard from "./GamingPresenceCard";
import CurrentRotation from "./CurrentRotation";
import ContinuePlayingCard from "./ContinuePlayingCard";
import GuildSpotlightCard from "./GuildSpotlightCard";
import RecentActivityCard from "./RecentActivityCard";
import GamingMasteryContributionCard from "./GamingMasteryContributionCard";
import ReleaseCalendarCard from "./ReleaseCalendarCard";
import HorizontalLane from "./mobile/HorizontalLane";

export default function GamingDashboard({
  isLoggedIn, avatarUrl, firstName, lastName, username, gdScore,
  masteryScore, masteryLevel, masteryBreakdown, wishlist, linkedSteamId, userId,
  masteryXp,
  customizingLayout: _customizingLayout,
  dashboardLayout: _dashboardLayout,
  setDashboardLayout: _setDashboardLayout,
  gridWidth: _gridWidth,
  gridContainerRef: _gridContainerRef,
  goTo, profileDetails, onRecomputeMastery,
}) {
  return (
    <>
      <ProfileHeading
        isLoggedIn={isLoggedIn}
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastName}
        username={username}
        gdScore={gdScore}
        masteryScore={masteryScore}
        masteryLevel={masteryLevel}
        userId={userId}
        linkedSteamId={linkedSteamId}
        onGoToSettings={() => goTo("settings")}
        onGoToLinking={() => goTo("linking")}
        onRecomputeMastery={onRecomputeMastery}
        profileDetails={profileDetails}
      />

      <HorizontalLane label="Right now">
        {isLoggedIn && <SteamPresenceCard userId={userId} linkedSteamId={linkedSteamId} />}
        {isLoggedIn && <GamingPresenceCard userId={userId} />}
        <CurrentRotation
          wishlist={wishlist}
          linkedSteamId={linkedSteamId}
          userId={userId}
          onOpenBacklog={() => goTo("backlog")}
          onOpenPrices={() => goTo("prices")}
        />
      </HorizontalLane>

      {/* Personal row — your own progress, at a glance */}
      <HorizontalLane label="Your progress" className="gaming-hero-grid">
        <ContinuePlayingCard linkedSteamId={linkedSteamId} onOpenLibrary={() => goTo("library")} />
        {isLoggedIn ? (
          <GamingMasteryContributionCard
            masteryScore={masteryScore}
            masteryLevel={masteryLevel}
            masteryXp={masteryXp}
            masteryBreakdown={masteryBreakdown}
            onOpenLinking={() => goTo("linking")}
          />
        ) : (
          <div className="panel hero-card">
            <div className="panel__head"><span className="panel__eyebrow">Gaming Mastery</span></div>
            <p className="panel__status">Sign in to see your Mastery breakdown here.</p>
          </div>
        )}
        <ReleaseCalendarCard wishlist={wishlist} linkedSteamId={linkedSteamId} onOpenUpcomingReleases={() => goTo("upcoming-releases")} />
      </HorizontalLane>

      {/* Social row — what your Guild and friends are up to, at a glance */}
      <HorizontalLane label="Social" className="gaming-secondary-grid">
        {isLoggedIn ? (
          <GuildSpotlightCard userId={userId} onOpenGuilds={() => goTo("guilds")} />
        ) : (
          <div className="panel hero-card">
            <div className="panel__head"><span className="panel__eyebrow">Guild Spotlight</span></div>
            <p className="panel__status">Sign in to see your Guilds here.</p>
          </div>
        )}
        {isLoggedIn ? (
          <RecentActivityCard userId={userId} onOpenGuilds={() => goTo("guilds")} />
        ) : (
          <div className="panel hero-card">
            <div className="panel__head"><span className="panel__eyebrow">Recent Activity</span></div>
            <p className="panel__status">Sign in to see real activity here.</p>
          </div>
        )}
      </HorizontalLane>
    </>
  );
}
