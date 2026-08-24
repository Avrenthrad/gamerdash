// Gaming College's own internal dashboard (view === "dashboard").
// Extracted out of App.jsx once this view grew a real hero section —
// see the plan notes for the redesign this came out of. Every widget
// here is backed by a real Lykodex data source (see each card
// component's own header comment for where its data comes from); no
// invented ranks/reputation/missions/combat stats.

import { lazy, Suspense } from "react";
import ProfileHeading from "./ProfileHeading";
import SteamPresenceCard from "./SteamPresenceCard";
import CurrentRotation from "./CurrentRotation";
import PriceSection from "./PriceSection";
import LiveServiceSection from "./LiveServiceSection";
import LibrarySection from "./LibrarySection";
import FriendSection from "./FriendSection";
import ContinuePlayingCard from "./ContinuePlayingCard";
import NowTrendingCard from "./NowTrendingCard";
import GuildSpotlightCard from "./GuildSpotlightCard";
import RecentActivityCard from "./RecentActivityCard";
import GamingMasteryContributionCard from "./GamingMasteryContributionCard";
import ReleaseCalendarCard from "./ReleaseCalendarCard";
import NewsAnnouncementsCard from "./NewsAnnouncementsCard";
import PageLoadingFallback from "./PageLoadingFallback";
import HorizontalLane from "./mobile/HorizontalLane";
import { isMobileApp } from "../lib/platform";

const GridLayout = lazy(() => import("react-grid-layout"));

// The RGL grid only knows about the widgets below — a stray "friends"
// entry can survive in someone's saved dashboardLayout from before
// Friend Details got promoted to a fixed section (see below), and
// react-grid-layout errors if a layout entry has no matching child.
const CUSTOMIZABLE_WIDGET_KEYS = ["price", "liveservice", "library"];

export default function GamingDashboard({
  isLoggedIn, avatarUrl, firstName, lastName, username, gdScore,
  masteryScore, masteryLevel, masteryBreakdown, wishlist, linkedSteamId, userId,
  enabledGames, currency, customizingLayout, dashboardLayout,
  setDashboardLayout, gridWidth, gridContainerRef, goTo,
  setCustomizingLayout, resetLayout,
}) {
  const safeDashboardLayout = dashboardLayout.filter((item) => CUSTOMIZABLE_WIDGET_KEYS.includes(item.i));

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
        wishlistCount={wishlist.length}
        onGoToSettings={() => goTo("settings")}
        onGoToLinking={() => goTo("linking")}
        customizingLayout={customizingLayout}
        onToggleCustomize={isMobileApp() ? undefined : () => setCustomizingLayout((v) => !v)}
        onResetLayout={resetLayout}
      />

      <HorizontalLane label="Right now">
        {isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}
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
        <NowTrendingCard onOpenHypeCharts={() => goTo("hype-charts")} />
        <NewsAnnouncementsCard linkedSteamId={linkedSteamId} />
      </HorizontalLane>

      <FriendSection
        isLoggedIn={isLoggedIn}
        onSignIn={() => goTo("login", "login")}
        onCreateAccount={() => goTo("login", "signup")}
        linkedSteamId={linkedSteamId}
        onGoToLinking={() => goTo("linking")}
        userId={userId}
      />

      {customizingLayout ? (
        <div className="dash-grid-wrap" ref={gridContainerRef}>
          {gridWidth > 0 && (
            <Suspense fallback={<PageLoadingFallback />}>
              <GridLayout
                className="dash-grid layout"
                layout={safeDashboardLayout}
                cols={12}
                rowHeight={30}
                width={gridWidth}
                onLayoutChange={(layout) => setDashboardLayout(layout)}
                draggableHandle=".dash-drag-handle"
                isResizable
                isDraggable
              >
                <div key="price" className="dash-grid-item">
                  <span className="dash-drag-handle" title="Drag to move">⠿</span>
                  <PriceSection wishlist={wishlist} onOpenFullPage={() => goTo("prices")} currency={currency} />
                </div>
                <div key="liveservice" className="dash-grid-item">
                  <span className="dash-drag-handle" title="Drag to move">⠿</span>
                  <LiveServiceSection enabledGames={enabledGames} />
                </div>
                <div key="library" className="dash-grid-item">
                  <span className="dash-drag-handle" title="Drag to move">⠿</span>
                  <LibrarySection
                    isLoggedIn={isLoggedIn}
                    onSignIn={() => goTo("login", "login")}
                    onCreateAccount={() => goTo("login", "signup")}
                    linkedSteamId={linkedSteamId}
                    onGoToLinking={() => goTo("linking")}
                    onGoToBacklog={() => goTo("backlog")}
                    onGoToLibrary={() => goTo("library")}
                  />
                </div>
              </GridLayout>
            </Suspense>
          )}
        </div>
      ) : (
        <div className="dash-stack">
          <PriceSection wishlist={wishlist} onOpenFullPage={() => goTo("prices")} currency={currency} />
          <LiveServiceSection enabledGames={enabledGames} />
          <LibrarySection
            isLoggedIn={isLoggedIn}
            onSignIn={() => goTo("login", "login")}
            onCreateAccount={() => goTo("login", "signup")}
            linkedSteamId={linkedSteamId}
            onGoToLinking={() => goTo("linking")}
            onGoToBacklog={() => goTo("backlog")}
            onGoToLibrary={() => goTo("library")}
          />
        </div>
      )}
    </>
  );
}
