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
import LoginPage from "./components/LoginPage";
import { AccountGatePage } from "./components/AccountGate";
import LoadingSplash from "./components/LoadingSplash";
import PageLoadingFallback from "./components/PageLoadingFallback";
import DesktopUpdateBanner from "./components/DesktopUpdateBanner";
import AndroidUpdateBanner from "./components/AndroidUpdateBanner";
import GamingDashboard from "./components/GamingDashboard";

import { useApp } from "./hooks/useApp";
import { initOAuthRedirectListener } from "./lib/oauthRedirect";

// Lazy-loaded secondary pages (same rationale as before)
const AccountLinkingPage = lazy(() => import("./components/AccountLinkingPage"));
const AccountSettingsPage = lazy(() => import("./components/AccountSettingsPage"));
const DashfeedSettingsPage = lazy(() => import("./components/DashfeedSettingsPage"));
const PriceComparisonPage = lazy(() => import("./components/PriceComparisonPage"));
const HypeChartsPage = lazy(() => import("./components/HypeChartsPage"));
const MarketPage = lazy(() => import("./components/MarketPage"));
const BacklogPage = lazy(() => import("./components/BacklogPage"));
const AchievementsPage = lazy(() => import("./components/AchievementsPage"));
const UpcomingReleasesPage = lazy(() => import("./components/UpcomingReleasesPage"));
const MtgSearchPage = lazy(() => import("./components/MtgSearchPage"));
const MtgCollectionPage = lazy(() => import("./components/MtgCollectionPage"));
const MtgDeckBuilderPage = lazy(() => import("./components/MtgDeckBuilderPage"));
const MtgPriceWatchPage = lazy(() => import("./components/MtgPriceWatchPage"));
const FabSearchPage = lazy(() => import("./components/FabSearchPage"));
const FabCollectionPage = lazy(() => import("./components/FabCollectionPage"));
const FabDeckBuilderPage = lazy(() => import("./components/FabDeckBuilderPage"));
const PokemonSearchPage = lazy(() => import("./components/PokemonSearchPage"));
const PokemonCollectionPage = lazy(() => import("./components/PokemonCollectionPage"));
const PokemonDeckBuilderPage = lazy(() => import("./components/PokemonDeckBuilderPage"));
const MtgScanPage = lazy(() => import("./components/MtgScanPage"));
const PokemonScanPage = lazy(() => import("./components/PokemonScanPage"));
const FabScanPage = lazy(() => import("./components/FabScanPage"));
const CsvImportPage = lazy(() => import("./components/CsvImportPage"));
const GuildsPage = lazy(() => import("./components/GuildsPage"));
const FriendsPage = lazy(() => import("./components/FriendsPage"));
const InboxPage = lazy(() => import("./components/InboxPage"));
const OverviewPage = lazy(() => import("./components/OverviewPage"));
const TcgHomePage = lazy(() => import("./components/TcgHomePage"));
const TcgMarketplacePage = lazy(() => import("./components/TcgMarketplacePage"));
const LibraryPage = lazy(() => import("./components/LibraryPage"));
const EntertainmentHomePage = lazy(() => import("./components/EntertainmentHomePage"));
const BooksPage = lazy(() => import("./components/BooksPage"));
const ComicsPage = lazy(() => import("./components/ComicsPage"));
const CollectiblesHomePage = lazy(() => import("./components/CollectiblesHomePage"));
const TabletopHomePage = lazy(() => import("./components/TabletopHomePage"));
const CurrentSalesPage = lazy(() => import("./components/CurrentSalesPage"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));

export default function App() {
  const {
    // nav
    view,
    loginMode,
    goTo,
    goBack,
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
    masteryScore,
    masteryXp,
    masteryLevel,
    masteryBreakdown,
    masteryComputedAt,
    recomputeMastery,
    overallMasteryScore,
    overallMasteryLevel,
    overallMasteryBreakdown,
    overallMasteryComputedAt,
    recomputeOverallMastery,
    themeMode,
    accentColor,
    setAccentColor,
    wallpaperUrl,
    setWallpaperUrl,
    currency,
    setCurrency,
    shareActivityWithGuilds,
    setShareActivityWithGuilds,
    readReceiptsEnabled,
    setReadReceiptsEnabled,
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

  // Universal command palette — Ctrl/Cmd+K from anywhere, or the
  // header search icon (see CommandPalette.jsx). Lives at this level
  // (not per-page) since it's a global overlay, not a route.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    function handleGlobalKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  // Google/Discord/etc OAuth sign-in on the packaged apps redirects
  // back via a custom URL scheme rather than a normal page navigation
  // — this is what actually applies the resulting session once the OS
  // hands that URL back to the app. No-ops entirely on plain web.
  useEffect(() => {
    initOAuthRedirectListener();
  }, []);

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
          overallMasteryScore={overallMasteryScore}
          overallMasteryLevel={overallMasteryLevel}
          overallMasteryBreakdown={overallMasteryBreakdown}
          overallMasteryComputedAt={overallMasteryComputedAt}
          onRecomputeOverallMastery={recomputeOverallMastery}
          onLogout={handleLogout}
          mode={themeMode}
          onToggleMode={toggleThemeMode}
          currentView={view}
          selectedColleges={selectedColleges}
          userId={userId}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <div className="dash-layout">
          {GAMING_VIEWS.includes(view) && (
            <GamingSidebar currentView={view} onNavigate={(id) => goTo(id)} />
          )}
          <div className={`dash ${view === "prices" ? "dash--wide" : ""}`}>
          {view === "linking" &&
            (isLoggedIn ? (
              <AccountLinkingPage
                userId={userId}
                linkedSteamId={linkedSteamId}
                onLinkSteam={(steamId) => {
                  setLinkedSteamId(steamId);
                  recomputeMastery(steamId).then(recomputeOverallMastery);
                }}
                onUnlinkSteam={() => {
                  setLinkedSteamId(null);
                  recomputeMastery(null).then(recomputeOverallMastery);
                }}
                onAddToWishlist={addToWishlist}
                masteryScore={masteryScore}
                masteryXp={masteryXp}
                masteryLevel={masteryLevel}
                masteryBreakdown={masteryBreakdown}
                masteryComputedAt={masteryComputedAt}
                onRecomputeMastery={recomputeMastery}
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
                wallpaperUrl={wallpaperUrl}
                onWallpaperChange={setWallpaperUrl}
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
                shareActivityWithGuilds={shareActivityWithGuilds}
                onShareActivityWithGuildsChange={setShareActivityWithGuilds}
                readReceiptsEnabled={readReceiptsEnabled}
                onReadReceiptsEnabledChange={setReadReceiptsEnabled}
                userId={userId}
                onGoToFriends={() => goTo("friends")}
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
              onOpenUpcomingReleases={() => goTo("upcoming-releases")}
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

          {view === "achievements" &&
            (isLoggedIn ? (
              <AchievementsPage onBack={() => goTo("dashboard")} userId={userId} linkedSteamId={linkedSteamId} />
            ) : (
              <AccountGatePage
                title="Achievements"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            ))}

          {view === "upcoming-releases" && (
            <UpcomingReleasesPage
              onBack={() => goTo("prices")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              wishlist={wishlist}
              linkedSteamId={linkedSteamId}
            />
          )}

          {view === "mtg-search" && (
            <MtgSearchPage
              onBack={() => goTo("tcg-home")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "fab-search" && (
            <FabSearchPage
              onBack={() => goTo("tcg-home")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "fab-collection" && (
            isLoggedIn ? (
              <FabCollectionPage
                onBack={() => goTo("tcg-home")}
                userId={userId}
                onGoToSearch={() => goTo("fab-search")}
                onGoToScan={() => goTo("fab-scan")}
                onGoToDecks={() => goTo("fab-decks")}
              />
            ) : (
              <AccountGatePage
                title="My Collection"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "fab-decks" && (
            isLoggedIn ? (
              <FabDeckBuilderPage onBack={() => goTo("tcg-home")} userId={userId} />
            ) : (
              <AccountGatePage
                title="Deck Builder"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "fab-scan" && (
            <FabScanPage
              onBack={() => goTo("fab-collection")}
              onGoToSearch={() => goTo("fab-search")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "pokemon-search" && (
            <PokemonSearchPage
              onBack={() => goTo("tcg-home")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "pokemon-collection" && (
            isLoggedIn ? (
              <PokemonCollectionPage
                onBack={() => goTo("tcg-home")}
                userId={userId}
                onGoToSearch={() => goTo("pokemon-search")}
                onGoToScan={() => goTo("pokemon-scan")}
                onGoToDecks={() => goTo("pokemon-decks")}
              />
            ) : (
              <AccountGatePage
                title="My Collection"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "pokemon-scan" && (
            <PokemonScanPage
              onBack={() => goTo("pokemon-collection")}
              onGoToSearch={() => goTo("pokemon-search")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "pokemon-decks" && (
            isLoggedIn ? (
              <PokemonDeckBuilderPage onBack={() => goTo("tcg-home")} userId={userId} />
            ) : (
              <AccountGatePage
                title="Deck Builder"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "mtg-scan" && (
            <MtgScanPage
              onBack={() => goTo("tcg-home")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "mtg-import" && (
            isLoggedIn ? (
              <CsvImportPage onBack={() => goTo("mtg-collection")} userId={userId} />
            ) : (
              <AccountGatePage
                title="Import Collection"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "guilds" && (
            <GuildsPage
              onBack={() => goBack("overview")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "friends" && (
            <FriendsPage
              onBack={() => goBack("overview")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              onGoToInbox={() => goTo("inbox")}
            />
          )}

          {view === "inbox" && (
            <InboxPage
              onBack={() => goBack("overview")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              readReceiptsEnabled={readReceiptsEnabled}
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
              onGoToFriends={() => goTo("friends")}
              onGoToGuilds={() => goTo("guilds")}
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

          {view === "tcg-marketplace" && (
            <TcgMarketplacePage
              onBack={() => goTo("tcg-home")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              currency={currency}
            />
          )}

          {view === "college-entertainment" && (
            <EntertainmentHomePage
              onBack={() => goTo("overview")}
              isLoggedIn={isLoggedIn}
              userId={userId}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
              onGoToBooks={() => goTo("books")}
              onGoToComics={() => goTo("comics")}
            />
          )}

          {view === "books" && (
            <BooksPage
              onBack={() => goTo("college-entertainment")}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onSignIn={() => goTo("login", "login")}
              onCreateAccount={() => goTo("login", "signup")}
            />
          )}

          {view === "comics" && (
            <ComicsPage
              onBack={() => goTo("college-entertainment")}
              userId={userId}
              isLoggedIn={isLoggedIn}
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
                onBack={() => goTo("tcg-home")}
                userId={userId}
                onGoToSearch={() => goTo("mtg-search")}
                onGoToScan={() => goTo("mtg-scan")}
                onGoToDecks={() => goTo("mtg-decks")}
                onGoToImport={() => goTo("mtg-import")}
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
              <MtgDeckBuilderPage onBack={() => goTo("tcg-home")} userId={userId} />
            ) : (
              <AccountGatePage
                title="Deck Builder"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {view === "mtg-price-watch" && (
            isLoggedIn ? (
              <MtgPriceWatchPage
                onBack={() => goTo("tcg-home")}
                userId={userId}
                onGoToSearch={() => goTo("mtg-search")}
              />
            ) : (
              <AccountGatePage
                title="Price Watch"
                onSignIn={() => goTo("login", "login")}
                onCreateAccount={() => goTo("login", "signup")}
              />
            )
          )}

          {/* ---------- Dashboard home ---------- */}
          {view === "dashboard" && (
            <GamingDashboard
              isLoggedIn={isLoggedIn}
              avatarUrl={avatarUrl}
              firstName={firstName}
              lastName={lastName}
              username={username}
              gdScore={gdScore}
              masteryScore={masteryScore}
              masteryLevel={masteryLevel}
              masteryBreakdown={masteryBreakdown}
              wishlist={wishlist}
              linkedSteamId={linkedSteamId}
              userId={userId}
              enabledGames={enabledGames}
              currency={currency}
              customizingLayout={customizingLayout}
              dashboardLayout={dashboardLayout}
              setDashboardLayout={setDashboardLayout}
              gridWidth={gridWidth}
              gridContainerRef={gridContainerRef}
              goTo={goTo}
              setCustomizingLayout={setCustomizingLayout}
              resetLayout={resetLayout}
            />
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
      <DesktopUpdateBanner />
      <AndroidUpdateBanner />
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNavigateView={navigateToView}
            isLoggedIn={isLoggedIn}
            userId={userId}
            linkedSteamId={linkedSteamId}
          />
        </Suspense>
      )}
    </>
  );
}
