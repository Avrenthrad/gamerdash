/**
 * AppContext — central state for Lykodex
 *
 * This replaces the previous 25 useState + 17 useEffect god-component
 * pattern in App.jsx. All session, profile, wishlist, theme, layout,
 * and dashfeed state lives here. Components consume what they need
 * via the hooks in ../hooks/useApp.js instead of prop drilling.
 *
 * Design notes kept from the original:
 * - Hydration guard prevents write-back from overwriting DB values
 *   with local defaults during the login fetch.
 * - Debounced profile writes (500ms) so rapid theme/currency toggles
 *   don't spam Supabase.
 * - Layout + platform order still work offline via localStorage
 *   when logged out.
 * - Personal API keys (XBXprices / PlatPrices) still flow through
 *   the same setters so the rest of the lib layer doesn't change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { initialWishlist } from "../data/wishlist";
import { DEFAULT_DASHBOARD_LAYOUT } from "../data/dashboardLayout";
import { DEFAULT_PLATFORM_ORDER } from "../data/platformOrder";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";
import { signOut as supabaseSignOut } from "../lib/auth";
import {
  fetchProfile,
  upsertProfile,
  fetchWishlist,
  insertWishlistItem,
  deleteWishlistItem,
} from "../lib/userData";
import { setPersonalXbxPricesKey } from "../lib/xbxprices";
import { setPersonalPlatPricesKey } from "../lib/platprices";
import { computeGdScore } from "../lib/gdScore";
import { logActivityForUser } from "../lib/guilds";
import { recomputeMastery as recomputeMasteryData } from "../lib/gameMasteryData";

// ---------- constants (same as before) ----------

const DASHFEED_GAMES = ["Destiny 2", "Fortnite", "League of Legends", "Valorant"];
const DASHFEED_STORES = [
  "Steam",
  "Xbox Store",
  "PlayStation Store",
  "GOG",
  "Epic Games Store",
  "Humble Store",
  "G2A",
];
const DASHFEED_PLATFORMS = [
  "Steam",
  "PlayStation",
  "Xbox",
  "Epic Games",
  "Riot Games",
  "Discord",
  "Nintendo",
];

const KNOWN_VIEWS = [
  "dashboard",
  "linking",
  "settings",
  "dashfeed",
  "onboarding",
  "prices",
  "hype-charts",
  "market",
  "sales",
  "backlog",
  "upcoming-releases",
  "mtg-search",
  "mtg-collection",
  "mtg-decks",
  "mtg-scan",
  "guilds",
  "overview",
  "library",
  "tcg-home",
  "college-entertainment",
  "college-collectibles",
  "college-tabletop",
];

const EXPECTED_LAYOUT_KEYS = DEFAULT_DASHBOARD_LAYOUT.map((item) => item.i)
  .sort()
  .join(",");

function allOn(list) {
  const map = {};
  list.forEach((item) => {
    map[item] = true;
  });
  return map;
}

function isValidLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== DEFAULT_DASHBOARD_LAYOUT.length) {
    return false;
  }
  const keys = layout
    .map((item) => item?.i)
    .sort()
    .join(",");
  if (keys !== EXPECTED_LAYOUT_KEYS) return false;
  return layout.every(
    (item) =>
      ["x", "y", "w", "h"].every(
        (k) => typeof item[k] === "number" && Number.isFinite(item[k]) && item[k] >= 0
      ) &&
      item.w > 0 &&
      item.h > 0
  );
}

function parseHash(hash) {
  const path = hash.replace(/^#\/?/, "");
  const [view, sub] = path.split("/");
  if (view === "login") {
    return { view: "login", loginMode: sub === "signup" ? "signup" : "login" };
  }
  return {
    view: KNOWN_VIEWS.includes(view) ? view : "overview",
    loginMode: "login",
  };
}

function hashFor(view, mode) {
  if (view === "login") {
    return `#/login/${mode === "signup" ? "signup" : "login"}`;
  }
  return `#/${view}`;
}

// ---------- context ----------

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ----- navigation -----
  const [view, setView] = useState("dashboard");
  const [loginMode, setLoginMode] = useState("login");

  // ----- auth -----
  const [session, setSession] = useState(null);
  const isLoggedIn = Boolean(session);
  const userId = session?.user?.id ?? null;

  // ----- profile -----
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [gdScore, setGdScore] = useState(0);
  const [linkedSteamId, setLinkedSteamId] = useState(null);

  // ----- Game Mastery Score (real Steam + self-reported Xbox/PS) -----
  // Cached on the profile, same pattern as gd_score — recomputed via
  // recomputeMastery() below right after a "new snapshot" event (Steam
  // link/unlink, or saving Xbox/PS self-reported numbers), not on
  // every render. See lib/gameMasteryData.js.
  const [masteryScore, setMasteryScore] = useState(0);
  const [masteryXp, setMasteryXp] = useState(0);
  const [masteryLevel, setMasteryLevel] = useState(0);
  const [masteryBreakdown, setMasteryBreakdown] = useState([]);
  const [masteryComputedAt, setMasteryComputedAt] = useState(null);

  const [themeMode, setThemeMode] = useState("dark");
  const [accentColor, setAccentColor] = useState("red");
  const [currency, setCurrency] = useState("AUD");
  const [xbxpricesKey, setXbxpricesKey] = useState("");
  const [platpricesKey, setPlatpricesKey] = useState("");

  // ----- wishlist -----
  const [wishlist, setWishlist] = useState(initialWishlist);

  // ----- dashfeed toggles -----
  // Bundles a handful of Account Settings fields (phone, timezone,
  // per-platform friend codes, streaming names, visibility toggles)
  // that were previously plain local useState in AccountSettingsPage
  // itself — never threaded up here, never written to Supabase, so
  // they silently reset to blank on every refresh. That was a real,
  // reported bug, not intentional scope — this is the actual fix,
  // one jsonb column instead of nine separate ones, matching how
  // Dashfeed's toggle groups are already bundled.
  const [profileDetails, setProfileDetailsState] = useState({});
  const updateProfileDetails = useCallback((patch) => {
    setProfileDetailsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const [gameToggles, setGameToggles] = useState(() => {
    try {
      const saved = localStorage.getItem("gd-dashfeed-games");
      return saved ? JSON.parse(saved) : allOn(DASHFEED_GAMES);
    } catch {
      return allOn(DASHFEED_GAMES);
    }
  });
  const [storeToggles, setStoreToggles] = useState(() => {
    try {
      const saved = localStorage.getItem("gd-dashfeed-stores");
      return saved ? JSON.parse(saved) : allOn(DASHFEED_STORES);
    } catch {
      return allOn(DASHFEED_STORES);
    }
  });
  const [platformToggles, setPlatformToggles] = useState(() => {
    try {
      const saved = localStorage.getItem("gd-dashfeed-platforms");
      return saved ? JSON.parse(saved) : allOn(DASHFEED_PLATFORMS);
    } catch {
      return allOn(DASHFEED_PLATFORMS);
    }
  });

  // ----- layout -----
  const [dashboardLayout, setDashboardLayout] = useState(() => {
    try {
      const saved = localStorage.getItem("gd-dashboard-layout");
      if (!saved) return DEFAULT_DASHBOARD_LAYOUT;
      const parsed = JSON.parse(saved);
      return isValidLayout(parsed) ? parsed : DEFAULT_DASHBOARD_LAYOUT;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });
  const [customizingLayout, setCustomizingLayout] = useState(false);

  // Post-signup onboarding sequence: welcome -> preferences (reuses
  // the real Dashfeed Settings page) -> linking (reuses the real
  // Account Linking page, skippable) -> dashboard. Purely local,
  // ephemeral state — this is a one-time first-run flow, nothing here
  // needs to survive a refresh or be written to Supabase.
  const [onboardingStep, setOnboardingStep] = useState("welcome");

  // Which of the 5 Colleges someone actually cares about — captured
  // during onboarding, used later to filter the top-level nav so
  // people aren't shown tabs for things they have no interest in.
  // Defaults to just Gaming, since that's the only College that's
  // fully real right now — everything else is explicitly opt-in.
  const [selectedColleges, setSelectedColleges] = useState(["gaming"]);
  const [platformOrder, setPlatformOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("gd-platform-order");
      return saved ? JSON.parse(saved) : DEFAULT_PLATFORM_ORDER;
    } catch {
      return DEFAULT_PLATFORM_ORDER;
    }
  });

  // ----- splash -----
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // ----- refs for hydration / debounced writes -----
  const hydratedRef = useRef(false);
  const writeTimerRef = useRef(null);

  // ---------- derived ----------
  const effectivePlatformOrder = useMemo(
    () => platformOrder.filter((name) => storeToggles[name] !== false),
    [platformOrder, storeToggles]
  );

  const enabledGames = useMemo(
    () => Object.keys(gameToggles).filter((g) => gameToggles[g]),
    [gameToggles]
  );

  // ---------- effects: personal API keys ----------
  useEffect(() => {
    setPersonalXbxPricesKey(xbxpricesKey);
  }, [xbxpricesKey]);

  useEffect(() => {
    setPersonalPlatPricesKey(platpricesKey);
  }, [platpricesKey]);

  // ---------- effects: localStorage persistence for offline prefs ----------
  useEffect(() => {
    try {
      localStorage.setItem("gd-dashfeed-games", JSON.stringify(gameToggles));
    } catch {
      /* ignore */
    }
  }, [gameToggles]);

  useEffect(() => {
    try {
      localStorage.setItem("gd-dashfeed-stores", JSON.stringify(storeToggles));
    } catch {
      /* ignore */
    }
  }, [storeToggles]);

  useEffect(() => {
    try {
      localStorage.setItem("gd-dashfeed-platforms", JSON.stringify(platformToggles));
    } catch {
      /* ignore */
    }
  }, [platformToggles]);

  useEffect(() => {
    try {
      localStorage.setItem("gd-dashboard-layout", JSON.stringify(dashboardLayout));
    } catch {
      /* ignore */
    }
  }, [dashboardLayout]);

  useEffect(() => {
    try {
      localStorage.setItem("gd-platform-order", JSON.stringify(platformOrder));
    } catch {
      /* ignore */
    }
  }, [platformOrder]);

  // ---------- effects: theme on <html> ----------
  useEffect(() => {
    document.documentElement.dataset.mode = themeMode;
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
  }, [accentColor]);

  // ---------- effects: GD Score ----------
  useEffect(() => {
    computeGdScore(linkedSteamId, wishlist.length).then(setGdScore);
  }, [linkedSteamId, wishlist.length]);

  // ---------- effects: auth session ----------
  useEffect(() => {
    if (!supabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ---------- effects: hydrate on login / reset on logout ----------
  useEffect(() => {
    if (!supabaseConfigured) return;

    if (!userId) {
      hydratedRef.current = false;
      setAvatarUrl(null);
      setFirstName("");
      setLastName("");
      setProfileDetailsState({});
      setUsername("");
      setGdScore(0);
      setWishlist([]);
      setLinkedSteamId(null);
      setMasteryScore(0);
      setMasteryXp(0);
      setMasteryLevel(0);
      setMasteryBreakdown([]);
      setMasteryComputedAt(null);
      setThemeMode("dark");
      setAccentColor("red");
      setCurrency("AUD");
      setXbxpricesKey("");
      setPlatpricesKey("");
      // Layout deliberately kept — still useful offline
      return;
    }

    let cancelled = false;
    hydratedRef.current = false;

    Promise.all([fetchProfile(userId), fetchWishlist(userId)])
      .then(([profile, wishlistRows]) => {
        if (cancelled) return;
        // Fall back to the OAuth provider's own avatar (Google/Discord
        // expose this in user_metadata) when nothing has been uploaded
        // to our own storage yet — better than showing the default
        // icon for someone who signed in with a provider that already
        // has a photo.
        setAvatarUrl(
          profile.avatar_url || session?.user?.user_metadata?.avatar_url || null
        );
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setUsername(profile.username || "");
        setGdScore(profile.gd_score || 0);
        setLinkedSteamId(profile.linked_steam_id || null);
        setMasteryScore(profile.mastery_score || 0);
        setMasteryXp(profile.mastery_xp || 0);
        setMasteryLevel(profile.mastery_level || 0);
        setMasteryBreakdown(profile.mastery_breakdown || []);
        setMasteryComputedAt(profile.mastery_computed_at || null);
        setThemeMode(profile.theme_mode || "dark");
        setAccentColor(profile.accent_color || "red");
        setCurrency(profile.currency || "AUD");
        setXbxpricesKey(profile.xbxprices_key || "");
        setPlatpricesKey(profile.platprices_key || "");
        if (profile.dashfeed_games) setGameToggles(profile.dashfeed_games);
        if (profile.dashfeed_stores) setStoreToggles(profile.dashfeed_stores);
        if (profile.dashfeed_platforms) setPlatformToggles(profile.dashfeed_platforms);
        setWishlist(wishlistRows);
        if (isValidLayout(profile.dashboard_layout)) {
          setDashboardLayout(profile.dashboard_layout);
        }
        if (profile.platform_order) {
          setPlatformOrder(profile.platform_order);
        }
        if (profile.profile_details) {
          setProfileDetailsState(profile.profile_details);
        }
        if (profile.selected_colleges) {
          setSelectedColleges(profile.selected_colleges);
        }
        hydratedRef.current = true;
      })
      .catch((err) => {
        console.error("Failed to load profile/wishlist:", err);
        hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
    // session is intentionally read but not a dep: it changes in the
    // same render as userId (userId is derived from it), so this only
    // needs to re-run on userId transitions, not every session update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- effects: debounced profile write-back ----------
  useEffect(() => {
    if (!supabaseConfigured || !userId || !hydratedRef.current) return;

    clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      upsertProfile(userId, {
        avatar_url: avatarUrl,
        first_name: firstName,
        last_name: lastName,
        username,
        theme_mode: themeMode,
        accent_color: accentColor,
        currency,
        linked_steam_id: linkedSteamId,
        dashboard_layout: dashboardLayout,
        platform_order: platformOrder,
        xbxprices_key: xbxpricesKey,
        platprices_key: platpricesKey,
        dashfeed_games: gameToggles,
        dashfeed_stores: storeToggles,
        dashfeed_platforms: platformToggles,
        profile_details: profileDetails,
        selected_colleges: selectedColleges,
        gd_score: gdScore,
      }).catch((err) => console.error("Failed to save profile:", err));
    }, 500);

    return () => clearTimeout(writeTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    avatarUrl,
    firstName,
    lastName,
    username,
    themeMode,
    accentColor,
    currency,
    linkedSteamId,
    dashboardLayout,
    platformOrder,
    xbxpricesKey,
    platpricesKey,
    gameToggles,
    storeToggles,
    platformToggles,
    profileDetails,
    selectedColleges,
    gdScore,
    userId,
  ]);

  // ---------- effects: hash routing ----------
  useEffect(() => {
    function syncFromHash() {
      const parsed = parseHash(window.location.hash);
      setView(parsed.view);
      setLoginMode(parsed.loginMode);
    }

    window.addEventListener("hashchange", syncFromHash);

    if (!window.location.hash) {
      window.history.replaceState(null, "", hashFor("dashboard"));
    } else {
      syncFromHash();
    }

    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  // ---------- effects: boot splash ----------
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 1300);
    const removeTimer = setTimeout(() => setSplashVisible(false), 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // ---------- actions ----------
  const goTo = useCallback((nextView, mode) => {
    window.location.hash = hashFor(nextView, mode);
  }, []);

  const navigateToSection = useCallback(
    (sectionId) => {
      goTo("dashboard");
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
      });
    },
    [goTo]
  );

  const navigateToView = useCallback(
    (viewId, mode) => {
      goTo(viewId, mode);
    },
    [goTo]
  );

  const navigateHome = useCallback(() => {
    goTo("overview");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, [goTo]);

  const handleLoginSuccess = useCallback(
    (mode) => {
      goTo(mode === "signup" ? "onboarding" : "dashboard");
    },
    [goTo]
  );

  const handleLogout = useCallback(() => {
    if (supabaseConfigured) {
      supabaseSignOut().catch((err) => console.error("Sign out failed:", err));
    }
    goTo("dashboard");
  }, [goTo]);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const addToWishlist = useCallback(
    (title) => {
      setWishlist((prev) => {
        if (prev.some((entry) => entry.title.toLowerCase() === title.toLowerCase())) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `w-${Date.now()}`,
            title,
            type: "game",
            addedAt: new Date().toISOString(),
          },
        ];
      });
      if (supabaseConfigured && userId) {
        insertWishlistItem(userId, title).catch((err) =>
          console.error("Failed to save wishlist add:", err)
        );
        logActivityForUser(userId, "wishlist_added", { title });
      }
    },
    [userId]
  );

  const removeFromWishlist = useCallback(
    (title) => {
      setWishlist((prev) =>
        prev.filter((entry) => entry.title.toLowerCase() !== title.toLowerCase())
      );
      if (supabaseConfigured && userId) {
        deleteWishlistItem(userId, title).catch((err) =>
          console.error("Failed to save wishlist removal:", err)
        );
      }
    },
    [userId]
  );

  const resetLayout = useCallback(() => {
    setDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
  }, []);

  // Recomputes the Mastery Score from whatever real data is actually
  // available right now (self-reported Xbox/PS inputs + live Steam
  // data if linked) and persists it. Called explicitly after a "new
  // snapshot" event — Steam link/unlink, saving Xbox Gamerscore, or
  // saving PS trophy counts — not on every render.
  //
  // Accepts an optional steamId override: right after linking/
  // unlinking Steam, the caller passes the new value directly rather
  // than relying on the linkedSteamId this closure captured, since
  // setLinkedSteamId's update isn't visible here yet in the same tick.
  const recomputeMastery = useCallback(async (steamIdOverride) => {
    if (!supabaseConfigured || !userId) return;
    try {
      const steamId = steamIdOverride !== undefined ? steamIdOverride : linkedSteamId;
      const result = await recomputeMasteryData(userId, steamId);
      setMasteryScore(result.masteryScore);
      setMasteryXp(result.accountXp);
      setMasteryLevel(result.accountLevel);
      setMasteryBreakdown(result.breakdown);
      setMasteryComputedAt(result.computedAt);
    } catch (err) {
      console.error("Failed to recompute Game Mastery:", err);
    }
  }, [userId, linkedSteamId]);

  // ---------- value (memoized so consumers don't re-render for nothing) ----------
  const value = useMemo(
    () => ({
      // navigation
      view,
      loginMode,
      goTo,
      navigateToSection,
      navigateToView,
      navigateHome,
      handleLoginSuccess,
      handleLogout,

      // auth
      session,
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
      themeMode,
      setThemeMode,
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

      // dashfeed
      gameToggles,
      setGameToggles,
      storeToggles,
      setStoreToggles,
      platformToggles,
      setPlatformToggles,
      enabledGames,
      effectivePlatformOrder,
      profileDetails,
      selectedColleges,
      setSelectedColleges,
      updateProfileDetails,

      // layout
      dashboardLayout,
      setDashboardLayout,
      customizingLayout,
      onboardingStep,
      setOnboardingStep,
      setCustomizingLayout,
      platformOrder,
      setPlatformOrder,
      resetLayout,

      // splash
      splashVisible,
      splashFading,
    }),
    [
      view,
      loginMode,
      goTo,
      navigateToSection,
      navigateToView,
      navigateHome,
      handleLoginSuccess,
      handleLogout,
      session,
      isLoggedIn,
      userId,
      avatarUrl,
      firstName,
      lastName,
      username,
      gdScore,
      linkedSteamId,
      masteryScore,
      masteryXp,
      masteryLevel,
      masteryBreakdown,
      masteryComputedAt,
      recomputeMastery,
      themeMode,
      accentColor,
      currency,
      xbxpricesKey,
      platpricesKey,
      toggleThemeMode,
      wishlist,
      addToWishlist,
      removeFromWishlist,
      gameToggles,
      storeToggles,
      platformToggles,
      enabledGames,
      effectivePlatformOrder,
      profileDetails,
      selectedColleges,
      setSelectedColleges,
      updateProfileDetails,
      dashboardLayout,
      customizingLayout,
      onboardingStep,
      setOnboardingStep,
      platformOrder,
      resetLayout,
      splashVisible,
      splashFading,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside <AppProvider>");
  }
  return ctx;
}
