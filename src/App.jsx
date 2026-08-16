/**
 * App.jsx — thin composition + routing layer
 *
 * All state and side-effects now live in AppProvider.
 * This file only decides what to render based on the current view
 * and passes the (now much fewer) props that child components still
 * expect. Future work: migrate individual pages to use the hooks
 * directly so even these remaining props can disappear.
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import Header, { GAMING_VIEWS } from "./components/Header";
import GamingSidebar from "./components/GamingSidebar";
import OnboardingWelcomeStep from "./components/OnboardingWelcomeStep";
import OnboardingCollegePicker from "./components/OnboardingCollegePicker";
import PriceSection from "./components/PriceSection";
import LibrarySection from "./components/LibrarySection";
import LiveServiceSection from "./components/LiveServiceSection";
import FriendSection from "./components/FriendSection";
import LoginPage from "./components/LoginPage";
import ProfileHeading from "./components/ProfileHeading";
import { AccountGatePage } from "./components/AccountGate";
import LoadingSplash from "./components/LoadingSplash";
import PageLoadingFallback from "./components/PageLoadingFallback";
import CurrentRotation from "./components/CurrentRotation";

import { useApp } from "./hooks/useApp";

// Lazy-loaded secondary pages (same rationale as before)
const GridLayout = lazy(() => import("react-grid-layout"));
const AccountLinkingPage = lazy(() => import("./components/AccountLinkingPage"));
const AccountSettingsPage = lazy(() => import("./components/AccountSettingsPage"));
const DashfeedSettingsPage = lazy(() => import("./components/DashfeedSettingsPage"));
const PriceComparisonPage = lazy(() => import("./components/PriceComparisonPage"));
const HypeChartsPage = lazy(() => import("./components/HypeChartsPage"));
const MarketPage = lazy(() => import("./components/MarketPage"));
const BacklogPage = lazy(() => import("./components/BacklogPage"));
const UpcomingReleasesPage = lazy(() => import("./components/UpcomingReleasesPage"));
const MtgSearchPage = lazy(() => import("./components/MtgSearchPage"));
const MtgCollectionPage = lazy(() => import("./components/MtgCollectionPage"));
const MtgDeckBuilderPage = lazy(() => import("./components/MtgDeckBuilderPage"));
const MtgScanPage = lazy(() => import("./components/MtgScanPage"));
const GuildsPage = lazy(() => import("./components/GuildsPage"));
const OverviewPage = lazy(() => import("./components/OverviewPage"));
const TcgHomePage = lazy(() => import("./components/TcgHomePage"));
const LibraryPage = lazy(() => import("./components/LibraryPage"));
const EntertainmentHomePage = lazy(() => import("./components/EntertainmentHomePage"));
const CollectiblesHomePage = lazy(() => import("./components/CollectiblesHomePage"));
const TabletopHomePage = lazy(() => import("./components/TabletopHomePage"));
const CurrentSalesPage = lazy(() => import("./components/CurrentSalesPage"));

export default function App() {
  const {
    // nav
    view,
    loginMode,
    goTo,
    navigateToView,
    navigateHome,
    handleLoginSuccess,
    handleLogout,

    // auth
    isLoggedIn,
    userId,

    // profile
    avatarUrl,
    setAvatarUrl,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    username,
    setUsername,
    gdScore,
    linkedSteamId,
    setLinkedSteamId,
    themeMode,
    accentColor,
    setAccentColor,
    currency,
    setCurrency,
    xbxpricesKey,
    setXbxpricesKey,
    platpricesKey,
    setPlatpricesKey,
    toggleThemeMode,

    // wishlist
    wishlist,
    addToWishlist,
    removeFromWishlist,

    // dashfeed / layout
    gameToggles,
    setGameToggles,
    storeToggles,
    setStoreToggles,
    platformToggles,
    setPlatformToggles,
    enabledGames,
    effectivePlatformOrder,
    profileDetails,
    updateProfileDetails,
    dashboardLayout,
    setDashboardLayout,
    customizingLayout,
    onboardingStep,
    setOnboardingStep,
    selectedColleges,
    setSelectedColleges,
    setCustomizingLayout,
    platformOrder,
    setPlatformOrder,
    resetLayout,

    // splash
    splashVisible,
    splashFading,
  } = useApp();

  // Local UI-only measurement for react-grid-layout (kept here on purpose —
  // it is pure presentation and does not belong in the shared context).
  const gridContainerRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!customizingLayout || !gridContainerRef.current) return;

    const el = gridContainerRef.current;
    const measure = () => setGridWidth(el.offsetWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [customizingLayout]);

  // ---------- view content ----------
  let content;

  if (view === "login") {
    content = (
      <LoginPage onLoginSuccess={handleLoginSuccess} initialMode={loginMode} />
    );
  } else if (view === "onboarding") {
    const steps = ["welcome", "college-picker", "preferences", "linking"];
    const stepIndex = steps.indexOf(onboardingStep);

    const progressDots = (
      <div className="onboarding-progress">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`onboarding-progress__dot ${
              i === stepIndex ? "onboarding-progress__dot--active" : i < stepIndex ? "onboarding-progress__dot--done" : ""
            }`}
          />
        ))}
      </div>
    );

    if (onboardingStep === "welcome") {
      content = (
        <>
          <OnboardingWelcomeStep firstName={firstName} onContinue={() => setOnboardingStep("college-picker")} />
          {progressDots}
        </>
      );
    } else if (onboardingStep === "college-picker") {
      content = (
        <>
          <OnboardingCollegePicker
            selected={selectedColleges}
            onChange={setSelectedColleges}
            onContinue={() => setOnboardingStep("preferences")}
          />
          {progressDots}
        </>
      );
    } else if (onboardingStep === "preferences") {
      content = (
        <>
          <DashfeedSettingsPage
            variant="onboarding"
            onFinishOnboarding={() => setOnboardingStep("linking")}
            gameToggles={gameToggles}
            onGameTogglesChange={setGameToggles}
            storeToggles={storeToggles}
            onStoreTogglesChange={setStoreToggles}
            platformToggles={platformToggles}
            onPlatformTogglesChange={setPlatformToggles}
          />
          {progressDots}
        </>
      );
    } else {
      // linking — real Account Linking page, wrapped with a skip
      // option since linking any account is genuinely optional.
      content = (
        <>
          <AccountLinkingPage
            linkedSteamId={linkedSteamId}
            onLinkSteam={setLinkedSteamId}
            onUnlinkSteam={() => setLinkedSteamId(null)}
            onAddToWishlist={addToWishlist}
          />
          <button type="button" className="onboarding-skip" onClick={() => goTo("dashboard")}>
            Skip for now — you can link accounts any time in Account Settings
          </button>
          {progressDots}
        </>
      );
    }
  } else {
    content = (
      <>
        <Header
          onNavigateView={navigateToView}
          onNavigateHome={navigateHome}
          isLoggedIn={isLoggedIn}
          avatarUrl={avatarUrl}
          gdScore={gdScore}
          onLogout={handleLogout}
          mode={themeMode}
          onToggleMode={toggleThemeMode}
          currentView={view}
          selectedColleges={selectedColleges}
        />

        <div className="dash-layout">
          {GAMING_VIEWS.includes(view) && (
            <GamingSidebar currentView={view} onNavigate={(id) => goTo(id)} />
          )}
          <div className="dash">
          {view === "linking" &&
            (isLoggedIn ? (
              <AccountLinkingPage
                linkedSteamId={linkedSteamId}
                onLinkSteam={setLinkedSteamId}
                onUnlinkSteam={() => setLinkedSteamId(null)}
                onAddToWishlist={addToWishlist}
              />
            ) : (
              <AccountGatePage
                title="Account Linking"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            ))}

          {view === "settings" &&
            (isLoggedIn ? (
              <AccountSettingsPage
                avatarUrl={avatarUrl}
                onAvatarChange={setAvatarUrl}
                firstName={firstName}
                onFirstNameChange={setFirstName}
                lastName={lastName}
                onLastNameChange={setLastName}
                username={username}
                onUsernameChange={setUsername}
                themeMode={themeMode}
                onThemeModeChange={toggleThemeMode}
                accentColor={accentColor}
                onAccentColorChange={setAccentColor}
                currency={currency}
                onCurrencyChange={setCurrency}
                platformOrder={platformOrder}
                onPlatformOrderChange={setPlatformOrder}
                xbxpricesKey={xbxpricesKey}
                onXbxpricesKeyChange={setXbxpricesKey}
                platpricesKey={platpricesKey}
                onPlatpricesKeyChange={setPlatpricesKey}
                profileDetails={profileDetails}
                onProfileDetailsChange={updateProfileDetails}
                selectedColleges={selectedColleges}
                onSelectedCollegesChange={setSelectedColleges}
                userId={userId}
              />
            ) : (
              <AccountGatePage
                title="Account Management"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            ))}

          {view === "dashfeed" &&
            (isLoggedIn ? (
              <DashfeedSettingsPage
                gameToggles={gameToggles}
                onGameTogglesChange={setGameToggles}
                storeToggles={storeToggles}
                onStoreTogglesChange={setStoreToggles}
                platformToggles={platformToggles}
                onPlatformTogglesChange={setPlatformToggles}
              />
            ) : (
              <AccountGatePage
                title="Dashfeed Settings"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            ))}

          {view === "prices" && (
            <PriceComparisonPage
              wishlist={wishlist}
              onAddToWishlist={addToWishlist}
              onRemoveFromWishlist={removeFromWishlist}
              onOpenHypeCharts={() => goTo("hype-charts")}
              onOpenMarket={() => goTo("market")}
              onOpenSales={() => goTo("sales")}
              linkedSteamId={linkedSteamId}
              currency={currency}
              onCurrencyChange={setCurrency}
              platformOrder={effectivePlatformOrder}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "hype-charts" && (
            <HypeChartsPage
              onBack={() => goTo("prices")}
              wishlist={wishlist}
              onAddToWishlist={addToWishlist}
              onRemoveFromWishlist={removeFromWishlist}
              currency={currency}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              platformOrder={effectivePlatformOrder}
            />
          )}

          {view === "market" && <MarketPage onBack={() => goTo("prices")} />}

          {view === "sales" && <CurrentSalesPage onBack={() => goTo("prices")} currency={currency} />}

          {view === "backlog" &&
            (isLoggedIn ? (
              <BacklogPage onBack={() => goTo("dashboard")} userId={userId} linkedSteamId={linkedSteamId} />
            ) : (
              <AccountGatePage
                title="Backlog"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            ))}

          {view === "upcoming-releases" && (
            <UpcomingReleasesPage
              onBack={() => goTo("dashboard")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              wishlist={wishlist}
              linkedSteamId={linkedSteamId}
            />
          )}

          {view === "mtg-search" && (
            <MtgSearchPage
              onBack={() => goTo("dashboard")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "mtg-scan" && (
            <MtgScanPage
              onBack={() => goTo("dashboard")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "guilds" && (
            <GuildsPage
              onBack={() => goTo("dashboard")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "overview" && (
            <OverviewPage
              isLoggedIn={isLoggedIn}
              userId={userId}
              linkedSteamId={linkedSteamId}
              selectedColleges={selectedColleges}
              onOpenCollege={(collegeId) => {
                if (collegeId === "gaming") goTo("dashboard");
                else if (collegeId === "tcg") goTo("tcg-home");
                else if (collegeId === "entertainment") goTo("college-entertainment");
                else if (collegeId === "collectibles") goTo("college-collectibles");
                else if (collegeId === "tabletop") goTo("college-tabletop");
              }}
            />
          )}

          {view === "library" && (
            <LibraryPage
              onBack={() => goTo("dashboard")}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              userId={userId}
              linkedSteamId={linkedSteamId}
              onGoToLinking={() => goTo("linking")}
              onGoToBacklog={() => goTo("backlog")}
              gdScore={gdScore}
            />
          )}

          {view === "tcg-home" && <TcgHomePage onNavigate={(id) => goTo(id)} isLoggedIn={isLoggedIn} userId={userId} />}

          {view === "college-entertainment" && (
            <EntertainmentHomePage
              onBack={() => goTo("overview")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "college-collectibles" && (
            <CollectiblesHomePage
              onBack={() => goTo("overview")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "college-tabletop" && (
            <TabletopHomePage
              onBack={() => goTo("overview")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "mtg-collection" && (
            isLoggedIn ? (
              <MtgCollectionPage
                onBack={() => goTo("dashboard")}
                userId={userId}
                onGoToSearch={() => goTo("mtg-search")}
                onGoToScan={() => goTo("mtg-scan")}
              />
            ) : (
              <AccountGatePage
                title="My Collection"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "mtg-decks" && (
            isLoggedIn ? (
              <MtgDeckBuilderPage onBack={() => goTo("dashboard")} userId={userId} />
            ) : (
              <AccountGatePage
                title="Deck Builder"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {/* ---------- Dashboard home ---------- */}
          {view === "dashboard" && (
            <>
              <ProfileHeading
                isLoggedIn={isLoggedIn}
                avatarUrl={avatarUrl}
                firstName={firstName}
                lastName={lastName}
                username={username}
                gdScore={gdScore}
                wishlistCount={wishlist.length}
                onGoToSettings={() => goTo("settings")}
                onGoToLinking={() => goTo("linking")}
                customizingLayout={customizingLayout}
                onToggleCustomize={() => setCustomizingLayout((v) => !v)}
                onResetLayout={resetLayout}
              />

              <CurrentRotation
                wishlist={wishlist}
                onOpenBacklog={() => goTo("backlog")}
                onOpenPrices={() => goTo("prices")}
              />

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
                          <span className="dash-drag-handle" title="Drag to move">
                            ⠿
                          </span>
                          <PriceSection
                            wishlist={wishlist}
                            onOpenFullPage={() => goTo("prices")}
                            currency={currency}
                          />
                        </div>
                        <div key="liveservice" className="dash-grid-item">
                          <span className="dash-drag-handle" title="Drag to move">
                            ⠿
                          </span>
                          <LiveServiceSection enabledGames={enabledGames} />
                        </div>
                        <div key="library" className="dash-grid-item">
                          <span className="dash-drag-handle" title="Drag to move">
                            ⠿
                          </span>
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
                          <span className="dash-drag-handle" title="Drag to move">
                            ⠿
                          </span>
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
                <>
                  <main className="dash-grid">
                    <PriceSection
                      wishlist={wishlist}
                      onOpenFullPage={() => goTo("prices")}
                      currency={currency}
                    />
                    <LiveServiceSection enabledGames={enabledGames} />
                  </main>
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
                </>
              )}
            </>
          )}
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      {splashVisible && <LoadingSplash fadingOut={splashFading} />}
      <Suspense fallback={<PageLoadingFallback />}>{content}</Suspense>
    </>
  );
}
