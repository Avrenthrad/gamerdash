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
import PageLoadingFallback from "./PageLoadingFallback";

const GridLayout = lazy(() => import("react-grid-layout"));

export default function GamingDashboard({
  isLoggedIn, avatarUrl, firstName, lastName, username, gdScore,
  masteryScore, masteryLevel, wishlist, linkedSteamId, userId,
  enabledGames, currency, customizingLayout, dashboardLayout,
  setDashboardLayout, gridWidth, gridContainerRef, goTo,
  setCustomizingLayout, resetLayout,
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
        wishlistCount={wishlist.length}
        onGoToSettings={() => goTo("settings")}
        onGoToLinking={() => goTo("linking")}
        customizingLayout={customizingLayout}
        onToggleCustomize={() => setCustomizingLayout((v) => !v)}
        onResetLayout={resetLayout}
      />

      {isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}

      <CurrentRotation
        wishlist={wishlist}
        onOpenBacklog={() => goTo("backlog")}
        onOpenPrices={() => goTo("prices")}
      />

      <div className="gaming-hero-grid">
        <ContinuePlayingCard linkedSteamId={linkedSteamId} onOpenLibrary={() => goTo("library")} />
        <NowTrendingCard onOpenHypeCharts={() => goTo("hype-charts")} />
        {isLoggedIn ? (
          <GuildSpotlightCard userId={userId} onOpenGuilds={() => goTo("guilds")} />
        ) : (
          <div className="panel hero-card">
            <div className="panel__head"><span className="panel__eyebrow">Guild Spotlight</span></div>
            <p className="panel__status">Sign in to see your Guilds here.</p>
          </div>
        )}
      </div>
      <div className="gaming-secondary-grid">
        {isLoggedIn ? (
          <RecentActivityCard userId={userId} onOpenGuilds={() => goTo("guilds")} />
        ) : (
          <div className="panel hero-card">
            <div className="panel__head"><span className="panel__eyebrow">Recent Activity</span></div>
            <p className="panel__status">Sign in to see real activity here.</p>
          </div>
        )}
        <LiveServiceSection enabledGames={enabledGames} />
        <PriceSection wishlist={wishlist} onOpenFullPage={() => goTo("prices")} currency={currency} />
      </div>

      {customizingLayout ? (
        <div className="dash-grid-wrap" ref={gridContainerRef}>
          {gridWidth > 0 && (
            <Suspense fallback={<PageLoadingFallback />}>
              <GridLayout
                className="dash-grid layout"
                layout={dashboardLayout}
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
                <div key="friends" className="dash-grid-item">
                  <span className="dash-drag-handle" title="Drag to move">⠿</span>
                  <FriendSection
                    isLoggedIn={isLoggedIn}
                    onSignIn={() => goTo("login", "login")}
                    onCreateAccount={() => goTo("login", "signup")}
                    linkedSteamId={linkedSteamId}
                    onGoToLinking={() => goTo("linking")}
                    userId={userId}
                  />
                </div>
              </GridLayout>
            </Suspense>
          )}
        </div>
      ) : (
        <div className="dash-stack">
          <LibrarySection
            isLoggedIn={isLoggedIn}
            onSignIn={() => goTo("login", "login")}
            onCreateAccount={() => goTo("login", "signup")}
            linkedSteamId={linkedSteamId}
            onGoToLinking={() => goTo("linking")}
            onGoToBacklog={() => goTo("backlog")}
            onGoToLibrary={() => goTo("library")}
          />
          <FriendSection
            isLoggedIn={isLoggedIn}
            onSignIn={() => goTo("login", "login")}
            onCreateAccount={() => goTo("login", "signup")}
            linkedSteamId={linkedSteamId}
            onGoToLinking={() => goTo("linking")}
            userId={userId}
          />
        </div>
      )}
    </>
  );
}
