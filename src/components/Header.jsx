// Top navigation bar.
// - Left: clicking the logo opens a full-height drawer linking to each
//   of the 4 dashboard sections, plus standalone pages like Store
//   Tracker and Upcoming Releases that get a full page instead of an
//   in-page scroll (see handleCategoryClick below).
// - Center: the "Lykodex" banner + logo — clicking it goes back to
//   the dashboard home.
// - Right: Login button (small popover with Sign in / New account) or
//   the user's avatar once signed in, the unified GD Score, and the
//   gear icon which opens a full-height drawer for account pages.
// The GD Score is a placeholder for Stage 1 — it gets calculated for
// real in Stage 9 (the achievement scoring algorithm).

import { useState } from "react";
import LykodexLogo from "./LykodexLogo";

// Top-level College tabs. Order matters — this is the fixed display
// order regardless of which ones a person actually selected during
// onboarding (filtering happens where this is rendered, not here).
const COLLEGES = [
  { id: "gaming", label: "Gaming", view: "dashboard" },
  { id: "tcg", label: "TCG", view: "tcg-home" },
  { id: "entertainment", label: "Entertainment", view: "college-entertainment" },
  { id: "collectibles", label: "Collectibles", view: "college-collectibles" },
  { id: "tabletop", label: "Tabletop", view: "college-tabletop" },
];

// Gaming's own sub-pages — shown as a left sidebar only while inside
// the Gaming College specifically (see App.jsx's GamingSidebar usage).
// Kept here since it's genuinely Header-adjacent navigation data, not
// because Header renders it directly.
export const GAMING_SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Overview" },
  { id: "library", label: "Library" },
  { id: "prices", label: "Prices & Wishlist" },
  { id: "backlog", label: "Backlog" },
  { id: "upcoming-releases", label: "Upcoming Releases" },
  { id: "guilds", label: "Guilds" },
];

// Views that belong to the Gaming College — used to decide whether
// the Gaming tab should show as active and whether the sidebar shows.
export const GAMING_VIEWS = [
  "dashboard", "library", "prices", "hype-charts", "market", "sales",
  "backlog", "upcoming-releases", "linking", "settings", "dashfeed",
];

export const TCG_VIEWS = ["tcg-home", "mtg-search", "mtg-collection", "mtg-decks", "mtg-scan"];

function DefaultAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export default function Header({
  onNavigateView,
  onNavigateHome,
  isLoggedIn,
  avatarUrl,
  gdScore,
  onLogout,
  mode,
  onToggleMode,
  currentView,
  selectedColleges = ["gaming"],
}) {
  // "settings" | "login" | "avatar" | null — only one open at a time.
  // "logo" (the old Dashboards drawer trigger) is gone — the logo now
  // just navigates straight to Overview, and the College tabs replace
  // what that drawer used to list.
  const [openMenu, setOpenMenu] = useState(null);

  function toggleMenu(name) {
    setOpenMenu(openMenu === name ? null : name);
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  function handleAccountClick(viewId, mode) {
    closeMenu();
    onNavigateView(viewId, mode);
  }

  const showBackdrop = openMenu === "settings";

  const activeCollegeId = GAMING_VIEWS.includes(currentView)
    ? "gaming"
    : TCG_VIEWS.includes(currentView)
    ? "tcg"
    : currentView === "college-entertainment"
    ? "entertainment"
    : currentView === "college-collectibles"
    ? "collectibles"
    : currentView === "college-tabletop"
    ? "tabletop"
    : null;

  return (
    <>
      <header className="dash-header">
        <div className="dash-header__inner">
        <div className="dash-header__left-group">
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleMode}
            aria-label="Toggle light/dark mode"
            aria-pressed={mode === "light"}
            title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            <span className="theme-toggle__track">
              <span className="theme-toggle__thumb">
                {mode === "light" ? (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v3M12 20v3M23 12h-3M4 12H1M20.5 3.5l-2 2M5.5 18.5l-2 2M20.5 20.5l-2-2M5.5 5.5l-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5z" />
                  </svg>
                )}
              </span>
            </span>
          </button>

          </div>

          <div className="dash-header__center">
            <button type="button" className="dash-header__banner" onClick={onNavigateHome}>
              <LykodexLogo className="dash-header__banner-mark" />
              <span className="dash-header__banner-text">Lykodex</span>
            </button>

          <span className="alpha-badge">
            <span className="alpha-badge__title">Alpha</span>
            <span className="alpha-badge__subtitle">Early access use only</span>
          </span>
        </div>

        <div className="dash-header__right">
          <div className="dash-header__score" title="Unified Lykodex score">
            <span className="dash-header__score-label">GD Score</span>
            <span className="dash-header__score-value">
              {isLoggedIn ? gdScore.toLocaleString() : "--"}
            </span>
          </div>

          {isLoggedIn ? (
            <div className="dash-header__menu-wrap">
              <button
                type="button"
                className="dash-header__avatar-btn"
                onClick={() => toggleMenu("avatar")}
                aria-expanded={openMenu === "avatar"}
                aria-label="Your account"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="dash-header__avatar-img" />
                ) : (
                  <span className="dash-header__avatar-default">
                    <DefaultAvatarIcon />
                  </span>
                )}
              </button>

              {openMenu === "avatar" && (
                <div className="dash-header__popover dash-header__popover--right">
                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={() => handleAccountClick("guilds")}
                  >
                    Guilds
                  </button>
                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={() => handleAccountClick("settings")}
                  >
                    Account Settings
                  </button>
                  <button
                    type="button"
                    className="dash-header__popover-item dash-header__popover-item--danger"
                    onClick={() => {
                      closeMenu();
                      onLogout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="dash-header__menu-wrap">
              <button
                type="button"
                className="dash-header__login-btn"
                onClick={() => toggleMenu("login")}
                aria-expanded={openMenu === "login"}
              >
                Login
              </button>

              {openMenu === "login" && (
                <div className="dash-header__popover dash-header__popover--right">
                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={() => handleAccountClick("login", "login")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={() => handleAccountClick("login", "signup")}
                  >
                    New account
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="dash-header__menu-wrap">
            <button
              type="button"
              className="dash-header__gear"
              onClick={() => toggleMenu("settings")}
              aria-expanded={openMenu === "settings"}
              aria-label="Account menu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
        </div>
      </header>

      {/* College tabs — filtered to what the person actually selected
          during onboarding (defaults to just Gaming). Guilds is
          deliberately not a tab here — it's a cross-cutting social
          feature, not a College, reachable from the avatar menu below
          instead. */}
      <nav className="college-tabs" aria-label="Colleges">
        {/* Guests haven't been through onboarding, so they never had
            a chance to pick which Colleges they care about — showing
            only their (default, single-College) preference would trap
            them on Gaming with no way out. Everyone gets all 5 tabs to
            browse until they're actually logged in and have a real
            preference to respect. */}
        {(isLoggedIn ? COLLEGES.filter((c) => selectedColleges.includes(c.id)) : COLLEGES).map((c) => (
          <button
            key={c.id}
            type="button"
            className={`college-tabs__item ${activeCollegeId === c.id ? "college-tabs__item--active" : ""}`}
            onClick={() => onNavigateView(c.view)}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {/* Rendered OUTSIDE <header> deliberately — the header has
          backdrop-filter for the floating/blurred sticky look, and
          filter/backdrop-filter on an ancestor creates a new
          containing block for position:fixed descendants. With the
          drawers nested inside <header>, "fixed" was resolving
          relative to the header's own (short) box instead of the
          viewport, squashing the drawer into a tiny scrollable box.
          Keeping them as siblings avoids that entirely. */}
      {showBackdrop && <div className="dash-drawer-backdrop" onClick={closeMenu} />}


      {openMenu === "settings" && (
        <div className="dash-drawer dash-drawer--right">
          <div className="dash-drawer__head">
            <span className="dash-drawer__title">Account</span>
            <button type="button" className="dash-drawer__close" onClick={closeMenu} aria-label="Close menu">
              <CloseIcon />
            </button>
          </div>
          <div className="dash-drawer__list">
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("dashfeed")}
            >
              Dashfeed Settings
            </button>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("settings")}
            >
              Account Management
            </button>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("linking")}
            >
              Account Linking
            </button>
          </div>
        </div>
      )}
    </>
  );
}
