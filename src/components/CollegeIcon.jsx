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
  // Clapperboard, rebuilt: the old version had the hinge stripes
  // floating disconnected above the body with a 2-unit gap, which read
  // as stray off-center marks rather than a clapper. Now a solid top
  // bar (the clapper) sits flush against the body, with the diagonal
  // stripes cut into the bar itself instead of hovering above it.
  entertainment: (
    <>
      <rect x="4.5" y="6" width="15" height="4.6" rx="1" fill={WHITE} />
      <path d="M4.5 6l3-3h3l-3 3zM11 6l3-3h3l-3 3z" fill="var(--rose)" />
      <rect x="4.5" y="11.4" width="15" height="8.2" rx="1.8" fill={WHITE} />
      <path d="M8 15.2l5 2.9-5 2.9z" fill="var(--rose)" />
    </>
  ),
  // Trophy, rebuilt: the old neck (1.8 wide) and base sat 4 units below
  // the cup with nothing connecting them, so it read as disconnected
  // floating pieces rather than one trophy. Cup, neck, and base now
  // each touch the next with no gap, and the neck is wide enough not
  // to vanish into a hairline.
  collectibles: (
    <>
      <path d="M7 4h10l-1.2 5H8.2z" fill={WHITE} />
      <path d="M7 4.6H5.2a2 2 0 0 0 1.8 3.9" fill="none" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M17 4.6h1.8a2 2 0 0 1-1.8 3.9" fill="none" stroke={WHITE} strokeWidth="1.3" strokeLinecap="round" />
      <rect x="10.8" y="9" width="2.4" height="4.5" fill="var(--amber)" />
      <path d="M8.5 19h7l-1-5.5h-5z" fill="var(--amber)" />
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
