// Shared College icon set — one consistent glyph per College, reused
// across the top nav tabs, the Gaming sub-nav, Overview cards, and
// both College pickers instead of a per-screen ad-hoc icon.
//
// Each College gets its own colored circular badge rather than one
// fixed brand color — reusing the categorical accent tokens already
// established elsewhere in the app (achievements=amber, price=teal,
// progress=violet, library=rose, live-service=sky, friends=lime), so
// this doesn't introduce new hues, just extends an existing system.
// The glyph itself stays a flat white mark on top, for contrast
// against whichever badge color it lands on.
//
// active/inactive is a single opacity toggle applied once here, not a
// second asset or a CSS rule duplicated at every call site.

const WHITE = "#FFFFFF";

export const BADGE_COLOR = {
  gaming: "var(--sky)",
  tcg: "var(--violet)",
  entertainment: "var(--rose)",
  collectibles: "var(--amber)",
  tabletop: "var(--lime)",
};

function Badge({ color }) {
  return <circle cx="12" cy="12" r="11" fill={color} />;
}

const GLYPHS = {
  gaming: (
    <>
      <rect x="4" y="9" width="16" height="8" rx="4" fill={WHITE} />
      <path d="M7.4 11.6v3.2M5.8 13.2h3.2" stroke="var(--sky)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15.1" cy="12.3" r="0.95" fill="var(--sky)" />
      <circle cx="17.6" cy="14.1" r="0.95" fill="var(--sky)" />
    </>
  ),
  tcg: (
    <>
      <rect x="5" y="3.6" width="10" height="13" rx="1.6" fill="none" stroke={WHITE} strokeWidth="1.3" />
      <rect x="9" y="6.6" width="10" height="13" rx="1.6" fill="var(--violet)" stroke={WHITE} strokeWidth="1.3" />
      <path d="M14 10.8l1.7 2.4-1.7 2.4-1.7-2.4z" fill={WHITE} />
    </>
  ),
  entertainment: (
    <>
      <rect x="4" y="8.6" width="16" height="10.8" rx="2.2" fill={WHITE} />
      <path d="M4.8 8.6l1.7-3.8h3.3l-1.7 3.8zM10.3 8.6l1.7-3.8h3.3l-1.7 3.8z" fill="var(--rose)" />
      <path d="M10.4 12.1l4.6 2.7-4.6 2.7z" fill="var(--rose)" />
    </>
  ),
  collectibles: (
    <>
      <path d="M8 4h8v3.6a4 4 0 0 1-8 0V4z" fill={WHITE} />
      <path d="M8 4.8H6.2a1.8 1.8 0 0 0 1.8 3.5" fill="none" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16 4.8h1.8a1.8 1.8 0 0 1-1.8 3.5" fill="none" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" />
      <rect x="11.1" y="11.6" width="1.8" height="3" fill="var(--amber)" />
      <path d="M9 19h6l-.7-3.4H9.7z" fill="var(--amber)" />
    </>
  ),
  tabletop: (
    <>
      <path d="M12 3.4l7 4v9.2l-7 4-7-4V7.4z" fill={WHITE} />
      <path d="M12 3.4l3.6 5.4H8.4z" fill="var(--lime)" />
      <path d="M12 20.6l-3.6-5.4h7.2z" fill="var(--lime)" />
      <path
        d="M5 7.4l7 2.2 7-2.2M5 16.6l7-2.2 7 2.2M12 9.6v6.8"
        fill="none"
        stroke="var(--lime)"
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
      <Badge color={BADGE_COLOR[collegeId]} />
      {glyph}
    </svg>
  );
}
