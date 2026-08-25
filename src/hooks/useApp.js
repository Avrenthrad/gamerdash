/**
 * Convenience re-exports + focused selectors.
 *
 * Components should prefer the specific hooks when they only need a
 * slice of state — this keeps re-renders narrower once we start
 * splitting the context later if needed.
 */

import { useContext } from "react";
import { AppContext } from "../context/appContextInstance";

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside <AppProvider>");
  }
  return ctx;
}

/** Auth + session only */
export function useAuth() {
  const {
    session,
    isLoggedIn,
    userId,
    handleLoginSuccess,
    handleLogout,
  } = useApp();
  return { session, isLoggedIn, userId, handleLoginSuccess, handleLogout };
}

/** Profile fields + setters */
export function useProfile() {
  const {
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
    currency,
    setCurrency,
    xbxpricesKey,
    setXbxpricesKey,
    platpricesKey,
    setPlatpricesKey,
  } = useApp();

  return {
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
    currency,
    setCurrency,
    xbxpricesKey,
    setXbxpricesKey,
    platpricesKey,
    setPlatpricesKey,
  };
}

/** Theme only */
export function useTheme() {
  const { themeMode, setThemeMode, accentColor, setAccentColor, toggleThemeMode } =
    useApp();
  return { themeMode, setThemeMode, accentColor, setAccentColor, toggleThemeMode };
}

/** Wishlist only */
export function useWishlist() {
  const { wishlist, addToWishlist, removeFromWishlist } = useApp();
  return { wishlist, addToWishlist, removeFromWishlist };
}

/** Navigation helpers */
export function useNavigation() {
  const {
    view,
    loginMode,
    goTo,
    navigateToSection,
    navigateToView,
    navigateHome,
  } = useApp();
  return { view, loginMode, goTo, navigateToSection, navigateToView, navigateHome };
}

/** Layout + dashfeed preferences */
export function useDashboardPrefs() {
  const {
    dashboardLayout,
    setDashboardLayout,
    customizingLayout,
    setCustomizingLayout,
    platformOrder,
    setPlatformOrder,
    resetLayout,
    gameToggles,
    setGameToggles,
    storeToggles,
    setStoreToggles,
    platformToggles,
    setPlatformToggles,
    enabledGames,
    effectivePlatformOrder,
  } = useApp();

  return {
    dashboardLayout,
    setDashboardLayout,
    customizingLayout,
    setCustomizingLayout,
    platformOrder,
    setPlatformOrder,
    resetLayout,
    gameToggles,
    setGameToggles,
    storeToggles,
    setStoreToggles,
    platformToggles,
    setPlatformToggles,
    enabledGames,
    effectivePlatformOrder,
  };
}
