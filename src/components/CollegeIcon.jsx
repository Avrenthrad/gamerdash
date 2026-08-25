// Shared College icon set — one consistent glyph per College, reused
// across the top nav tabs, the Gaming sub-nav, Overview cards, both
// College pickers, and the Overview hero centerpiece.
//
// Restyled to match a glossy "3D badge" reference the user liked
// (rendered concepts: a shaded controller, cards + a diamond suit, a
// play triangle, a faceted gem, an isometric die) instead of the
// previous flat single-color-on-circle look. The badge circle keeps
// the existing categorical accent token (sky/violet/rose/amber/lime —
// achievements/price/progress/library/live-service/friends elsewhere
// in the app) so it still respects that system and any future
// re-theme; only a highlight + shadow overlay (clipped to the circle)
// gets layered on top for the glossy-sphere look. The glyphs themselves
// use fixed multi-tone hex fills, since a believable facet/bevel needs
// real distinct tones rather than one CSS var lightened on the fly.
//
// Each instance generates its own gradient/clip-path ids via useId —
// this icon renders many times on the same page at once (nav tabs,
// pickers, hero), and SVG ids must be unique per document or later
// instances silently reuse the first one found.
//
// active/inactive is a single opacity toggle applied once here, not a
// second asset or a CSS rule duplicated at every call site.

import { useId } from "react";

export const BADGE_COLOR = {
  gaming: "var(--sky)",
  tcg: "var(--violet)",
  entertainment: "var(--rose)",
  collectibles: "var(--amber)",
  tabletop: "var(--lime)",
};

// Glossy-sphere treatment: a soft white highlight toward the upper
// left (where the light source implicitly sits for every glyph's own
// shading below, so the two stay consistent) and a soft dark shadow
// toward the lower edge, both clipped to the badge circle.
function GlossOverlay({ clipId }) {
  return (
    <g clipPath={`url(#${clipId})`}>
      <ellipse cx="8.3" cy="7" rx="8.5" ry="6.6" fill="#FFFFFF" opacity="0.22" />
      <ellipse cx="12" cy="18.5" rx="10" ry="6" fill="#000000" opacity="0.16" />
    </g>
  );
}

// Rebuilt on the original flat design's body shape (a plain rounded
// rect — already proven legible, never flagged) instead of the
// freeform silhouette from the first glossy pass, which crammed
// thumbsticks + D-pad + buttons into one small area and made the
// D-pad/buttons nearly invisible (dark grey on dark grey). Shading is
// now just a top-lit gradient on the body, with the D-pad/buttons in
// a light silver tone for real contrast against the dark body.
function GamingGlyph({ gradId }) {
  return (
    <>
      <rect x="4" y="9" width="16" height="8" rx="4" fill={`url(#${gradId})`} />
      <path d="M7.4 11.6v3.2M5.8 13.2h3.2" stroke="#C7CDD6" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15.1" cy="12.3" r="1" fill="#C7CDD6" />
      <circle cx="17.6" cy="14.1" r="1" fill="#C7CDD6" />
    </>
  );
}

function TcgGlyph() {
  return (
    <>
      <rect x="5" y="3.6" width="10" height="13" rx="1.6" fill="#F3F0FF" stroke="#C6BBF7" strokeWidth="1" />
      <rect x="9" y="6.6" width="10" height="13" rx="1.6" fill="#FBF9FF" stroke="#C6BBF7" strokeWidth="1" />
      <path d="M14 10.6l2 2.6-2 2.6-2-2.6z" fill="none" stroke="#8C7CE0" strokeWidth="1.1" strokeLinejoin="round" />
    </>
  );
}

// Play triangle — swapped in for the old clapperboard per the
// reference (a media "play" mark reads faster than a clapperboard at
// this size, and matches what the user picked).
function EntertainmentGlyph() {
  return (
    <>
      <path d="M7.2 6.8v10.4c0 .8.9 1.3 1.5.8l7.6-5.2c.6-.4.6-1.2 0-1.6L8.7 6c-.6-.4-1.5 0-1.5.8z" fill="#FCA5AE" />
      <path d="M7.2 6.8v2.4l8.4 3.6-8.4-6z" fill="#FFD9DD" opacity="0.6" />
    </>
  );
}

// Faceted gem — swapped in for the old trophy per the reference. The
// first pass had 5 facet paths built from independent guesses at
// coordinates, so their edges didn't actually line up — overlaps and
// gaps between facets made it read as a muddy blob rather than a gem.
// Rebuilt from ONE shared vertex set (TL, TR, L, R, B, and interior
// point C — which sits exactly on the L-R line, at their midpoint) so
// the 5 triangles below tile the outer diamond edge-to-edge with zero
// overlap and zero gap. Shaded as if lit from the upper left, same
// direction as GlossOverlay, so the whole badge reads as one light
// source: brightest at top, darkest at lower-right.
function CollectiblesGlyph() {
  return (
    <>
      <path d="M8 6 L16 6 L12 9 Z" fill="#FFEFC2" stroke="#8C6015" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M8 6 L12 9 L5 9 Z" fill="#FCDD8E" stroke="#8C6015" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M16 6 L19 9 L12 9 Z" fill="#E3A93F" stroke="#8C6015" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M5 9 L12 9 L12 19 Z" fill="#DDA23B" stroke="#8C6015" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M19 9 L12 9 L12 19 Z" fill="#B9791F" stroke="#8C6015" strokeWidth="0.4" strokeOpacity="0.5" />
    </>
  );
}

// Isometric die/cube — swapped in for the old d20 hexagon per the
// reference (a cube reads instantly as "tabletop/dice"; the flat
// hexagon needed the label to be understood as one).
function TabletopGlyph() {
  return (
    <>
      <path d="M12 5l7 3.5-7 3.5-7-3.5z" fill="#BFE8A7" />
      <path d="M5 8.5l7 3.5v7l-7-3.5z" fill="#5FA544" />
      <path d="M19 8.5l-7 3.5v7l7-3.5z" fill="#3D7A2C" />
    </>
  );
}

const GLYPH_COMPONENTS = {
  gaming: GamingGlyph,
  tcg: TcgGlyph,
  entertainment: EntertainmentGlyph,
  collectibles: CollectiblesGlyph,
  tabletop: TabletopGlyph,
};

// active defaults to true (full strength) since most call sites are
// plain display icons, not a toggle — only the College tabs actually
// pass active={false} for the non-selected tabs to dim them.
export default function CollegeIcon({ collegeId, size = 18, active = true, className = "" }) {
  const Glyph = GLYPH_COMPONENTS[collegeId];
  const uid = useId();
  if (!Glyph) return null;

  const clipId = `${uid}-clip`;
  const gradId = `${uid}-gaming-body`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`college-icon ${active ? "college-icon--active" : ""} ${className}`.trim()}
      style={{ opacity: active ? 1 : 0.55, transition: "opacity 0.2s ease" }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="11" />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#454B55" />
          <stop offset="1" stopColor="#1D2025" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={BADGE_COLOR[collegeId]} />
      <Glyph gradId={gradId} />
      <GlossOverlay clipId={clipId} />
    </svg>
  );
}
