// Shared College icon set — one consistent glyph per College, reused
// across the top nav tabs, Overview cards, and the onboarding picker
// instead of the previous ad-hoc emoji-per-screen. Same stroke
// language as Header's own SearchIcon/BellIcon (viewBox 24, fill
// none, stroke currentColor, strokeWidth 1.8, round caps/joins) so
// these read as part of the same icon family, not a bolted-on set.
// Color is entirely controlled by CSS `color` on the wrapper —
// active/inactive is just a class swap, not a second asset.

const GLYPHS = {
  gaming: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <path d="M6 10v4M4 12h4" />
      <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  tcg: (
    <>
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <rect x="9" y="6" width="12" height="16" rx="2" />
      <path d="M13 11l2 3-2 3-2-3z" fill="currentColor" stroke="none" />
    </>
  ),
  entertainment: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 9l1.5-4h4L7 9zM9 9l1.5-4h4L13 9zM15 9l1.5-4h4L19 9z" />
      <path d="M10.5 13.5l4 2.5-4 2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  collectibles: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 5H5a2 2 0 0 0 2 4" />
      <path d="M17 5h2a2 2 0 0 1-2 4" />
      <path d="M12 13v3" />
      <path d="M9 20h6" />
      <path d="M10 20l.5-4h3l.5 4" />
    </>
  ),
  tabletop: (
    <>
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
      <path d="M12 2v6.5M3.34 7l8.66 4.5M20.66 7l-8.66 4.5M12 11.5V22M3.34 17l8.66-6M20.66 17l-8.66-6" />
    </>
  ),
};

export default function CollegeIcon({ collegeId, size = 18, active = false, className = "" }) {
  const glyph = GLYPHS[collegeId];
  if (!glyph) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`college-icon ${active ? "college-icon--active" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
