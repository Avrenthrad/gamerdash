// Top navigation bar.
// - Left: light/dark theme toggle.
// - Center: the "Lykodex" banner/logo — clicking it goes to Overview.
// - Right: quick-jump search, the notifications bell (real Guild
//   activity), the unified GD Score, and — once signed in — the
//   avatar, which opens ONE consolidated account drawer (Social,
//   Account Settings, Account Linking, Dashfeed Settings, Log out).
//   There used to be a second, separate gear-icon menu here with an
//   overlapping subset of the same destinations — merged into the one
//   avatar drawer below so there's a single place to look, not two.
// - Below the header: the College tabs row (Overview + the 5 Colleges).

import { useEffect, useMemo, useRef, useState } from "react";
import LykodexLogo from "./LykodexLogo";
import { fetchRecentActivityForUser, describeActivity } from "../lib/guilds";
import { relativeTime } from "./price/priceUtils";

// Top-level College tabs. Order matters — this is the fixed display
// order regardless of which ones a person actually selected during
// onboarding (filtering happens where this is rendered, not here).
// Overview always leads — it's not a College, but it's the one place
// that summarizes across all of them, so it belongs in the same row.
const COLLEGES = [
  { id: "overview", label: "Overview", view: "overview", alwaysShown: true },
  { id: "gaming", label: "Gaming", view: "dashboard" },
  { id: "tcg", label: "TCG", view: "tcg-home" },
  { id: "entertainment", label: "Entertainment", view: "college-entertainment" },
  { id: "collectibles", label: "Collectibles", view: "college-collectibles" },
  { id: "tabletop", label: "Tabletop", view: "college-tabletop" },
];

// Quick-jump search index — every real, already-built destination in
// the app. This is genuine navigation, not a stubbed-out search box:
// typing filters this list and Enter/click jumps straight there. No
// invented "results" — just the app's own real pages.
const NAV_INDEX = [
  { label: "Overview", view: "overview", keywords: "home summary" },
  { label: "Gaming Dashboard", view: "dashboard", keywords: "gaming home" },
  { label: "Library", view: "library", keywords: "gaming games owned" },
  { label: "Prices & Wishlist", view: "prices", keywords: "gaming deals" },
  { label: "Backlog", view: "backlog", keywords: "gaming games" },
  { label: "Upcoming Releases", view: "upcoming-releases", keywords: "gaming calendar" },
  { label: "TCG Home", view: "tcg-home", keywords: "mtg magic cards" },
  { label: "MTG Search", view: "mtg-search", keywords: "tcg magic cards scryfall" },
  { label: "MTG Collection", view: "mtg-collection", keywords: "tcg magic cards" },
  { label: "MTG Deck Builder", view: "mtg-decks", keywords: "tcg magic decks" },
  { label: "MTG Card Scanner", view: "mtg-scan", keywords: "tcg magic ocr" },
  { label: "Entertainment", view: "college-entertainment", keywords: "movies tv anime books" },
  { label: "Collectibles", view: "college-collectibles", keywords: "shelf funko lego statues" },
  { label: "Tabletop", view: "college-tabletop", keywords: "rpg dnd wargames dice" },
  { label: "Guilds", view: "guilds", keywords: "social friends activity crew" },
  { label: "Friends", view: "friends", keywords: "social guilds add friend code" },
  { label: "Account Settings", view: "settings", keywords: "profile avatar theme" },
  { label: "Account Linking", view: "linking", keywords: "steam link connect" },
  { label: "Dashfeed Settings", view: "dashfeed", keywords: "toggles layout" },
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  userId,
}) {
  // "settings" | "login" | "avatar" | null — only one open at a time.
  // "logo" (the old Dashboards drawer trigger) is gone — the logo now
  // just navigates straight to Overview, and the College tabs replace
  // what that drawer used to list.
  const [openMenu, setOpenMenu] = useState(null);
  // Tracks a broken/failed avatar image load so we fall back to the
  // default icon instead of showing a broken-image glyph. Reset
  // whenever the URL itself changes (new upload, re-hydrate) so a
  // fresh URL always gets a real chance to load.
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  // ----- quick-jump search -----
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return NAV_INDEX.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.includes(q)
    ).slice(0, 8);
  }, [searchQuery]);

  // ----- notifications bell (real Guild activity, never fabricated) -----
  const [activity, setActivity] = useState([]);
  const [activityStatus, setActivityStatus] = useState("idle"); // idle | loading | ready | error
  const lastSeenRef = useRef(
    typeof window !== "undefined" ? localStorage.getItem("gd-activity-last-seen") : null
  );

  const notificationsOpen = openMenu === "notifications";
  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setActivity([]);
      setActivityStatus("idle");
      return;
    }
    let cancelled = false;
    setActivityStatus("loading");
    fetchRecentActivityForUser(userId, 8)
      .then((rows) => {
        if (cancelled) return;
        setActivity(rows);
        setActivityStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load activity for notifications bell:", err);
        if (!cancelled) setActivityStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userId, notificationsOpen]);

  const hasUnseenActivity =
    activity.length > 0 &&
    (!lastSeenRef.current || new Date(activity[0].created_at) > new Date(lastSeenRef.current));

  function toggleMenu(name) {
    const next = openMenu === name ? null : name;
    setOpenMenu(next);
    if (name === "notifications" && next === "notifications" && activity[0]) {
      lastSeenRef.current = activity[0].created_at;
      try {
        localStorage.setItem("gd-activity-last-seen", activity[0].created_at);
      } catch {
        /* ignore */
      }
    }
    if (name === "search" && next !== "search") setSearchQuery("");
  }

  function closeMenu() {
    setOpenMenu(null);
    setSearchQuery("");
  }

  function handleAccountClick(viewId, mode) {
    closeMenu();
    onNavigateView(viewId, mode);
  }

  function handleSearchSelect(view) {
    closeMenu();
    onNavigateView(view);
  }

  const showBackdrop = openMenu === "settings";

  const activeCollegeId =
    currentView === "overview"
      ? "overview"
      : GAMING_VIEWS.includes(currentView)
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
          <div className="dash-header__menu-wrap">
            <button
              type="button"
              className="dash-header__icon-btn"
              onClick={() => toggleMenu("search")}
              aria-expanded={openMenu === "search"}
              aria-label="Search Lykodex"
            >
              <SearchIcon />
            </button>

            {openMenu === "search" && (
              <div className="dash-header__popover dash-header__popover--right dash-header__search-popover">
                <input
                  type="text"
                  autoFocus
                  className="dash-header__search-input"
                  placeholder="Jump to a page…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResults[0]) handleSearchSelect(searchResults[0].view);
                    if (e.key === "Escape") closeMenu();
                  }}
                />
                {searchQuery.trim() && (
                  <div className="dash-header__search-results">
                    {searchResults.length > 0 ? (
                      searchResults.map((item) => (
                        <button
                          key={item.view}
                          type="button"
                          className="dash-header__popover-item"
                          onClick={() => handleSearchSelect(item.view)}
                        >
                          {item.label}
                        </button>
                      ))
                    ) : (
                      <p className="dash-header__search-empty">No pages match "{searchQuery}".</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isLoggedIn && (
            <div className="dash-header__menu-wrap">
              <button
                type="button"
                className="dash-header__icon-btn"
                onClick={() => toggleMenu("notifications")}
                aria-expanded={openMenu === "notifications"}
                aria-label="Notifications"
              >
                <BellIcon />
                {hasUnseenActivity && <span className="dash-header__icon-dot" aria-hidden="true" />}
              </button>

              {openMenu === "notifications" && (
                <div className="dash-header__popover dash-header__popover--right dash-header__notifications-popover">
                  <span className="dash-header__notifications-title">Guild activity</span>
                  {activityStatus === "loading" ? (
                    <p className="dash-header__search-empty">Loading…</p>
                  ) : activity.length > 0 ? (
                    activity.map((entry) => (
                      <div key={entry.id} className="dash-header__notification-row">
                        <span className="dash-header__notification-text">
                          {describeActivity(entry)}
                        </span>
                        <span className="dash-header__notification-meta">
                          {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
                          {relativeTime(entry.created_at)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="dash-header__empty-state">
                      <span className="dash-header__empty-state-icon" aria-hidden="true">
                        <BellIcon />
                      </span>
                      <p>No activity yet — join or create a Guild to see real updates from your crew here.</p>
                      <button
                        type="button"
                        className="dash-header__popover-item dash-header__empty-state-cta"
                        onClick={() => handleAccountClick("guilds")}
                      >
                        Explore Guilds
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                onClick={() => toggleMenu("settings")}
                aria-expanded={openMenu === "settings"}
                aria-label="Account menu"
              >
                {avatarUrl && !avatarBroken ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="dash-header__avatar-img"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <span className="dash-header__avatar-default">
                    <DefaultAvatarIcon />
                  </span>
                )}
              </button>
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
        {(isLoggedIn
          ? COLLEGES.filter((c) => c.alwaysShown || selectedColleges.includes(c.id))
          : COLLEGES
        ).map((c) => (
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
            <span className="dash-drawer__section-label">Social</span>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("guilds")}
            >
              Guilds
            </button>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("friends")}
            >
              Friends
            </button>

            <span className="dash-drawer__section-label">Account</span>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("settings")}
            >
              Account Settings
            </button>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("linking")}
            >
              Account Linking
            </button>
            <button
              type="button"
              className="dash-drawer__item"
              onClick={() => handleAccountClick("dashfeed")}
            >
              Dashfeed Settings
            </button>

            <div className="dash-drawer__divider" />
            <button
              type="button"
              className="dash-drawer__item dash-drawer__item--danger"
              onClick={() => {
                closeMenu();
                onLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
