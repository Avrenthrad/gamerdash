// Top navigation bar.
// - Left: light/dark theme toggle.
// - Center: the "Lykodex" banner/logo — clicking it goes to Overview.
// - Right: search icon (opens the universal command palette — see
//   CommandPalette.jsx and App.jsx's Ctrl/Cmd+K handler; this icon and
//   that shortcut open the exact same overlay, not two competing
//   search UIs), the notifications bell (real Guild activity), the
//   unified GD Score, and — once signed in — the avatar, which opens
//   ONE consolidated account drawer (Social, Account Settings, Account
//   Linking, Dashfeed Settings, Log out). There used to be a second,
//   separate gear-icon menu here with an overlapping subset of the
//   same destinations — merged into the one avatar drawer below so
//   there's a single place to look, not two.
// - Below the header: the College tabs row (Overview + the 5 Colleges).

import { useEffect, useRef, useState } from "react";
import LykodexLogo from "./LykodexLogo";
import CollegeIcon from "./CollegeIcon";
import { fetchRecentActivityForUser, describeActivity } from "../lib/guilds";
import { fetchUnreadCount } from "../lib/messages";
import { relativeTime } from "./price/priceUtils";
import MiniAvatar from "./MiniAvatar";

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

// The 5 real Colleges the Mastery Score dropdown breaks down by —
// same set as COLLEGES minus the "Overview" pseudo-entry.
const MASTERY_COLLEGES = COLLEGES.filter((c) => c.id !== "overview");

// Gaming's own sub-pages — shown as a left sidebar only while inside
// the Gaming College specifically (see App.jsx's GamingSidebar usage).
// Kept here since it's genuinely Header-adjacent navigation data, not
// because Header renders it directly.
export const GAMING_SIDEBAR_ITEMS = [
  // Labeled "Dashboard" rather than "Overview" — the top College tabs
  // already have an "Overview" (the cross-College summary page), and
  // both render at once on every Gaming page, so the two need visibly
  // different names even though this one still maps to the "dashboard" view.
  { id: "dashboard", label: "Dashboard" },
  { id: "backlog", label: "Backlog" },
  { id: "prices", label: "Market" },
  { id: "achievements", label: "Achievements" },
  { id: "library", label: "Library" },
];

// Views that belong to the Gaming College — used to decide whether
// the Gaming tab should show as active and whether the sidebar shows.
export const GAMING_VIEWS = [
  "dashboard", "library", "prices", "hype-charts", "market", "sales",
  "backlog", "achievements", "upcoming-releases", "linking", "settings", "dashfeed",
];

export const TCG_VIEWS = ["tcg-home", "mtg-search", "mtg-collection", "mtg-decks", "mtg-price-watch", "mtg-scan", "mtg-import", "tcg-marketplace", "fab-search", "fab-collection", "fab-decks", "fab-scan", "pokemon-search", "pokemon-collection", "pokemon-decks", "pokemon-scan"];

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

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M3 6l9 7 9-7" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function Header({
  onNavigateView,
  onNavigateHome,
  isLoggedIn,
  avatarUrl,
  overallMasteryScore = 0,
  overallMasteryLevel = 0,
  overallMasteryBreakdown = [],
  overallMasteryComputedAt,
  onRecomputeOverallMastery,
  onLogout,
  mode,
  onToggleMode,
  currentView,
  selectedColleges = ["gaming"],
  userId,
  onOpenPalette,
}) {
  // "settings" | "login" | "avatar" | null — only one open at a time.
  // "logo" (the old Dashboards drawer trigger) is gone — the logo now
  // just navigates straight to Overview, and the College tabs replace
  // what that drawer used to list.
  const [openMenu, setOpenMenu] = useState(null);
  const [recomputingMastery, setRecomputingMastery] = useState(false);
  // Tracks a broken/failed avatar image load so we fall back to the
  // default icon instead of showing a broken-image glyph. Reset
  // whenever the URL itself changes (new upload, re-hydrate) so a
  // fresh URL always gets a real chance to load.
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

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

  // ----- Inbox unread count — the one interval-polled query in this
  // app. Everything else here is poll-on-mount/on-demand, but DM
  // staleness is directly user-visible (a friend can message you while
  // you're elsewhere in the app with no natural "next visit" moment to
  // refetch on), so a light, cheap count-only poll is worth the
  // exception. Thread contents and the Inbox list itself stay
  // poll-on-mount only — see InboxPage.jsx.
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setUnreadDmCount(0);
      return;
    }
    let cancelled = false;
    function loadUnread() {
      fetchUnreadCount(userId)
        .then((count) => {
          if (!cancelled) setUnreadDmCount(count);
        })
        .catch((err) => console.error("Failed to load Inbox unread count:", err));
    }
    loadUnread();
    const interval = setInterval(loadUnread, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoggedIn, userId]);

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
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  function handleAccountClick(viewId, mode) {
    closeMenu();
    onNavigateView(viewId, mode);
  }

  async function handleRecomputeOverallMastery() {
    if (!onRecomputeOverallMastery) return;
    setRecomputingMastery(true);
    await onRecomputeOverallMastery();
    setRecomputingMastery(false);
  }

  const showBackdrop = openMenu === "settings";

  const activeCollegeId =
    currentView === "overview"
      ? "overview"
      : GAMING_VIEWS.includes(currentView)
      ? "gaming"
      : TCG_VIEWS.includes(currentView)
      ? "tcg"
      : currentView === "college-entertainment" || currentView === "books" || currentView === "comics"
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
          <button
            type="button"
            className="dash-header__icon-btn"
            onClick={onOpenPalette}
            aria-label="Search Lykodex (Ctrl/Cmd+K)"
            title="Search (Ctrl/Cmd+K)"
          >
            <SearchIcon />
          </button>

          {isLoggedIn && (
            <button
              type="button"
              className="dash-header__icon-btn"
              onClick={() => handleAccountClick("inbox")}
              aria-label="Inbox"
              title="Inbox"
            >
              <InboxIcon />
              {unreadDmCount > 0 && <span className="dash-header__icon-dot" aria-hidden="true" />}
            </button>
          )}

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
                        <span className="dash-header__notification-text" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MiniAvatar profile={entry.profile} />
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

          {isLoggedIn ? (
            <div className="dash-header__menu-wrap">
              <button
                type="button"
                className="dash-header__score dash-header__score--interactive"
                onClick={() => toggleMenu("mastery")}
                aria-expanded={openMenu === "mastery"}
                title="Mastery Score — combines a real score from each College"
              >
                <span className="dash-header__score-label">Mastery Score</span>
                <span className="dash-header__score-value">
                  {Math.round(overallMasteryScore).toLocaleString()}
                </span>
              </button>

              {openMenu === "mastery" && (
                <div className="dash-header__popover dash-header__popover--right dash-header__mastery-popover">
                  <div className="dash-header__mastery-total">
                    <span className="dash-header__mastery-total-value">
                      {Math.round(overallMasteryScore).toLocaleString()}
                    </span>
                    <span className="dash-header__mastery-total-label">Level {overallMasteryLevel}</span>
                  </div>

                  {overallMasteryBreakdown.length === 0 ? (
                    <p className="dash-header__search-empty">
                      Nothing tracked yet — add real progress in any College to start building this.
                    </p>
                  ) : (
                    <div className="dash-header__mastery-breakdown">
                      {MASTERY_COLLEGES.map((c) => {
                        const entry = overallMasteryBreakdown.find((b) => b.college === c.id);
                        return (
                          <div key={c.id} className="dash-header__mastery-row">
                            <CollegeIcon collegeId={c.id} size={16} />
                            <span className="dash-header__mastery-row-label">{c.label}</span>
                            <span className="dash-header__mastery-row-value">
                              {entry ? Math.round(entry.normalized) : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {overallMasteryComputedAt && (
                    <p className="dash-header__search-empty">Last computed {relativeTime(overallMasteryComputedAt)}.</p>
                  )}

                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={handleRecomputeOverallMastery}
                    disabled={recomputingMastery}
                  >
                    {recomputingMastery ? "Recomputing…" : "Recompute"}
                  </button>
                  <button
                    type="button"
                    className="dash-header__popover-item"
                    onClick={() => handleAccountClick("linking")}
                  >
                    View Gaming Mastery breakdown →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="dash-header__score" title="Sign in to build your Mastery Score">
              <span className="dash-header__score-label">Mastery Score</span>
              <span className="dash-header__score-value">--</span>
            </div>
          )}

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
            {c.id !== "overview" && (
              <CollegeIcon collegeId={c.id} size={16} active={activeCollegeId === c.id} />
            )}
            {c.label}
          </button>
        ))}
      </nav>

      {/* Mobile-only fixed bottom nav — hidden on desktop via CSS. The
          top College tabs row + header icon cluster above both get
          hidden at the same breakpoint (see index.css); this replaces
          them rather than adding on top, so mobile has exactly one
          navigation surface, not two competing ones. */}
      <nav className="mobile-tab-bar" aria-label="Primary">
        <button
          type="button"
          className={`mobile-tab-bar__item ${activeCollegeId === "overview" ? "mobile-tab-bar__item--active" : ""}`}
          onClick={() => onNavigateView("overview")}
        >
          <HomeIcon />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-bar__item ${openMenu === "settings" ? "mobile-tab-bar__item--active" : ""}`}
          onClick={() => toggleMenu("settings")}
        >
          <GridIcon />
          <span>Colleges</span>
        </button>
        <button type="button" className="mobile-tab-bar__item" onClick={onOpenPalette}>
          <SearchIcon />
          <span>Search</span>
        </button>
        {isLoggedIn && (
          <button type="button" className="mobile-tab-bar__item" onClick={() => handleAccountClick("inbox")}>
            <span className="mobile-tab-bar__icon-wrap">
              <InboxIcon />
              {unreadDmCount > 0 && <span className="mobile-tab-bar__dot" aria-hidden="true" />}
            </span>
            <span>Inbox</span>
          </button>
        )}
        <button
          type="button"
          className={`mobile-tab-bar__item ${openMenu === "settings" ? "mobile-tab-bar__item--active" : ""}`}
          onClick={() => (isLoggedIn ? toggleMenu("settings") : onNavigateView("login", "login"))}
        >
          <span className="mobile-tab-bar__icon-wrap">
            {isLoggedIn && avatarUrl && !avatarBroken ? (
              <img src={avatarUrl} alt="" className="mobile-tab-bar__avatar" onError={() => setAvatarBroken(true)} />
            ) : (
              <DefaultAvatarIcon />
            )}
            {isLoggedIn && hasUnseenActivity && <span className="mobile-tab-bar__dot" aria-hidden="true" />}
          </span>
          <span>{isLoggedIn ? "Account" : "Login"}</span>
        </button>
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
            <span className="dash-drawer__section-label drawer-mobile-only">Colleges</span>
            <div className="dash-drawer__college-grid drawer-mobile-only">
              {(isLoggedIn
                ? COLLEGES.filter((c) => c.alwaysShown || selectedColleges.includes(c.id))
                : COLLEGES
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`dash-drawer__college-item ${activeCollegeId === c.id ? "dash-drawer__college-item--active" : ""}`}
                  onClick={() => handleAccountClick(c.view)}
                >
                  {c.id !== "overview" && <CollegeIcon collegeId={c.id} size={18} active={activeCollegeId === c.id} />}
                  {c.label}
                </button>
              ))}
            </div>

            {isLoggedIn && (
              <>
                <span className="dash-drawer__section-label drawer-mobile-only">Notifications</span>
                <div className="dash-drawer__notifications-mobile drawer-mobile-only">
                  {activity.length > 0 ? (
                    activity.slice(0, 4).map((entry) => (
                      <div key={entry.id} className="dash-header__notification-row">
                        <span className="dash-header__notification-text" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MiniAvatar profile={entry.profile} />
                          {describeActivity(entry)}
                        </span>
                        <span className="dash-header__notification-meta">
                          {entry.guilds?.name ? `${entry.guilds.name} · ` : ""}
                          {relativeTime(entry.created_at)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="dash-header__search-empty">No activity yet — join or create a Guild to see updates here.</p>
                  )}
                </div>
              </>
            )}

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
