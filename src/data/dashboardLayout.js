// Default Quickdash card layout — a 12-column grid (react-grid-layout
// convention). Every card can be dragged and resized from here by the
// user. x/y are grid units, w/h are width/height in grid units (row
// height set on the grid itself).
//
// Order: Store Tracker, Game Services, Collections. Friend Details
// moved out of this customizable set and into a fixed section on the
// Gaming dashboard (see GamingDashboard.jsx) as part of the Overview
// rebuild — it's the deepest social content on the page, so it's
// always visible rather than needing "Customize layout" turned on to
// see it. Achievements removed entirely (see the earlier decision in
// this file's history — no legitimate personal achievement API exists
// for Xbox/PlayStation).

export const DEFAULT_DASHBOARD_LAYOUT = [
  { i: "price", x: 0, y: 0, w: 6, h: 8 },
  { i: "liveservice", x: 6, y: 0, w: 6, h: 9 },
  { i: "library", x: 0, y: 9, w: 12, h: 8 },
];
