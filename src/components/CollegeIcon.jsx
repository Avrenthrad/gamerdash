// Shared College icon set — one consistent glyph per College, reused
// across the top nav tabs, the Gaming sub-nav, Overview cards, and
// both College pickers instead of a per-screen ad-hoc icon.
//
// Deliberately fixed-palette (crimson + white on a dark chip), not
// `currentColor` — these are sub-brand marks (like a platform badge),
// not functional UI icons, so they stay legible and on-brand
// regardless of the surrounding surface: a light-mode card, a dark
// card, or the solid red "active" tab pill that would otherwise erase
// a currentColor icon painted the same red. The chip itself is always
// near-black, which is what keeps the mark readable on a light-mode
// card without a second per-surface variant (see the light/dark check
// in the College icons feature notes).
//
// active/inactive is a single opacity toggle applied once here, not a
// second asset or a CSS rule duplicated at every call site.

const CRIMSON = "#E10600";
const WHITE = "#FFFFFF";
const CHIP_BG = "#0A0A0C";

function Chip() {
  return <rect x="1" y="1" width="22" height="22" rx="6" fill={CHIP_BG} />;
}

const GLYPHS = {
  gaming: (
    <>
      <Chip />
      <rect x="4" y="9" width="16" height="8" rx="4" fill={CRIMSON} />
      <path d="M7.4 11.6v3.2M5.8 13.2h3.2" stroke={WHITE} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15.1" cy="12.3" r="0.95" fill={WHITE} />
      <circle cx="17.6" cy="14.1" r="0.95" fill={WHITE} />
    </>
  ),
  tcg: (
    <>
      <Chip />
      <rect x="5" y="3.6" width="10" height="13" rx="1.6" fill="none" stroke={WHITE} strokeWidth="1.3" />
      <rect x="9" y="6.6" width="10" height="13" rx="1.6" fill={CHIP_BG} stroke={WHITE} strokeWidth="1.3" />
      <path d="M14 10.8l1.7 2.4-1.7 2.4-1.7-2.4z" fill={CRIMSON} />
    </>
  ),
  entertainment: (
    <>
      <Chip />
      <rect x="4" y="8.6" width="16" height="10.8" rx="2.2" fill={CRIMSON} />
      <path d="M4.8 8.6l1.7-3.8h3.3l-1.7 3.8zM10.3 8.6l1.7-3.8h3.3l-1.7 3.8z" fill={WHITE} />
      <path d="M10.4 12.1l4.6 2.7-4.6 2.7z" fill={WHITE} />
    </>
  ),
  collectibles: (
    <>
      <Chip />
      <path d="M8 4h8v3.6a4 4 0 0 1-8 0V4z" fill={CRIMSON} />
      <path d="M8 4.8H6.2a1.8 1.8 0 0 0 1.8 3.5" fill="none" stroke={CRIMSON} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16 4.8h1.8a1.8 1.8 0 0 1-1.8 3.5" fill="none" stroke={CRIMSON} strokeWidth="1.3" strokeLinecap="round" />
      <rect x="11.1" y="11.6" width="1.8" height="3" fill={WHITE} />
      <path d="M9 19h6l-.7-3.4H9.7z" fill={WHITE} />
    </>
  ),
  tabletop: (
    <>
      <Chip />
      <path d="M12 3.4l7 4v9.2l-7 4-7-4V7.4z" fill={CRIMSON} />
      <path d="M12 3.4l3.6 5.4H8.4z" fill={WHITE} />
      <path d="M12 20.6l-3.6-5.4h7.2z" fill={WHITE} />
      <path
        d="M5 7.4l7 2.2 7-2.2M5 16.6l7-2.2 7 2.2M12 9.6v6.8"
        fill="none"
        stroke={CHIP_BG}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </>
  ),
};

// active defaults to true (full strength) since most call sites are
// plain display icons, not a toggle — only the College tabs actually
// pass active={false} for the non-selected tabs to dim them.
export default function CollegeIcon({ collegeId, size = 18, active = true, className = "" }) {
  const glyph = GLYPHS[collegeId];
  if (!glyph) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`college-icon ${active ? "college-icon--active" : ""} ${className}`.trim()}
      style={{ opacity: active ? 1 : 0.55, transition: "opacity 0.2s ease" }}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
