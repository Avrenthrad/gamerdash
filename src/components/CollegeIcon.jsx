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

function GamingGlyph() {
  return (
    <>
      <path
        d="M4.5 12.6c0-2.6 2-4.4 5.3-4.4h4.4c3.3 0 5.3 1.8 5.3 4.4 0 1.7-.4 3.6-1 5-.6 1.4-1.5 2.2-2.5 2.2-.8 0-1.3-.5-1.9-1.3-.5-.7-.9-1.1-1.6-1.1h-2.4c-.7 0-1.1.4-1.6 1.1-.6.8-1.1 1.3-1.9 1.3-1 0-1.9-.8-2.5-2.2-.6-1.4-1-3.3-1-5z"
        fill="#2B2F36"
      />
      <path d="M5.3 10.3c1-1 2.7-1.6 4.5-1.6h4.4c1.8 0 3.5.6 4.5 1.6-.9-.5-2.3-.8-4-.8h-5.4c-1.7 0-3.1.3-4 .8z" fill="#454B55" />
      <circle cx="9" cy="9.2" r="1.7" fill="#232629" />
      <circle cx="15" cy="9.2" r="1.7" fill="#232629" />
      <circle cx="9" cy="8.9" r="0.8" fill="#565E6B" />
      <circle cx="15" cy="8.9" r="0.8" fill="#565E6B" />
      <path d="M8.1 11.8v3.2M6.5 13.4h3.2" stroke="#8B93A1" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="15.1" cy="12.5" r="1" fill="#8B93A1" />
      <circle cx="17.4" cy="14.2" r="1" fill="#8B93A1" />
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

// Faceted gem — swapped in for the old trophy per the reference.
// Facet layout: one bright top facet, two upper side facets, two
// lower side facets, shaded as if lit from the upper left (same
// direction as GlossOverlay above) so the whole badge reads as one
// consistent light source.
function CollectiblesGlyph() {
  return (
    <>
      <path d="M8 6h8l3 3-7 10-7-10z" fill="#B9791F" />
      <path d="M8 6h8l-4 3z" fill="#FFEFC2" />
      <path d="M8 6l-3 3 7 10-4-10z" fill="#FCDD8E" />
      <path d="M16 6l3 3-7 10 4-10z" fill="#E3A93F" />
      <path d="M5 9h14l-7 10z" fill="#DDA23B" />
      <path d="M5 9h7l-7 0 3.5 3.5z" fill="#F0BE55" opacity="0.5" />
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
      </defs>
      <circle cx="12" cy="12" r="11" fill={BADGE_COLOR[collegeId]} />
      <Glyph />
      <GlossOverlay clipId={clipId} />
    </svg>
  );
}
