// Categorical accent color per College — reused by CollegeIcon.jsx's
// badge circle and CollegeMorphHero.jsx's ambient particle color.
// Moved out of CollegeIcon.jsx (which still imports it back) purely
// so Vite's Fast Refresh can treat that file as component-only again
// — a file that exports both a component and a plain constant forces
// a full-page reload on every edit instead of a hot swap.
export const BADGE_COLOR = {
  gaming: "var(--sky)",
  tcg: "var(--violet)",
  entertainment: "var(--rose)",
  collectibles: "var(--amber)",
  tabletop: "var(--lime)",
};
