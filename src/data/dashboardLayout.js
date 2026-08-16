// Default Quickdash card layout — a 12-column grid (react-grid-layout
// convention). Every card can be dragged and resized from here by the
// user. x/y are grid units, w/h are width/height in grid units (row
// height set on the grid itself).
//
// Order: Store Tracker, Game Services, Collections, Friends.
// Progress (formerly its own dashboard) is now merged into Friends —
// see FriendSection.jsx's "Your Progress" sub-section. Achievements
// removed entirely (see the earlier decision in this file's history —
// no legitimate personal achievement API exists for Xbox/PlayStation).

export const DEFAULT_DASHBOARD_LAYOUT = [
  { i: "price", x: 0, y: 0, w: 6, h: 8 },
  { i: "liveservice", x: 6, y: 0, w: 6, h: 9 },
  { i: "library", x: 0, y: 9, w: 6, h: 8 },
  { i: "friends", x: 0, y: 17, w: 12, h: 10 },
];
