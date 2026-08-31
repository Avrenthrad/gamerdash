// Nav section data — Gaming's sidebar items, and which views belong
// to the Gaming/TCG Colleges. Moved out of Header.jsx (which still
// uses all three internally, alongside GamingSidebar.jsx and App.jsx)
// purely so Vite's Fast Refresh can treat Header.jsx as a
// component-only file again — a file that exports both a component
// and plain constants forces a full-page reload on every edit instead
// of a hot swap.

// Gaming's own sub-pages — shown as a left sidebar only while inside
// the Gaming College specifically (see App.jsx's GamingSidebar usage).
export const GAMING_SIDEBAR_ITEMS = [
  // Labeled "Dashboard" rather than "Overview" — the top College tabs
  // already have an "Overview" (the cross-College summary page), and
  // both render at once on every Gaming page, so the two need visibly
  // different names even though this one still maps to the "dashboard" view.
  { id: "dashboard", label: "Dashboard" },
  { id: "backlog", label: "Backlog" },
  { id: "prices", label: "Market" },
  { id: "achievements", label: "Achievements" },
  { id: "library", label: "Gaming Collection" },
];

// Views that belong to the Gaming College — used to decide whether
// the Gaming tab should show as active and whether the sidebar shows.
export const GAMING_VIEWS = [
  "dashboard", "library", "prices", "hype-charts", "market", "sales",
  "backlog", "achievements", "upcoming-releases", "linking", "settings", "dashfeed",
];

export const TCG_VIEWS = ["tcg-home", "mtg-search", "mtg-collection", "mtg-decks", "mtg-price-watch", "mtg-scan", "mtg-import", "tcg-marketplace", "fab-search", "fab-collection", "fab-decks", "fab-scan", "pokemon-search", "pokemon-collection", "pokemon-decks", "pokemon-scan"];
