// Animated college emblem + title for each College home page.
// Compact inline header (~29px tall) with orbiting sigils themed per
// College — magic/arithmetic for TCG, arcade pulses for Gaming, etc.

import CollegeIcon from "./CollegeIcon";

const LABELS = {
  gaming: "Gaming",
  tcg: "TCG",
  entertainment: "Library",
  collectibles: "Loot",
  tabletop: "Wartable",
};

const SIGILS = {
  gaming: ["XP", "▶", "●", "◆"],
  tcg: ["+2", "×3", "♦", "÷4", "∑"],
  entertainment: ["▶", "24", "◼", "★"],
  collectibles: ["✦", "◇", "★", "◆"],
  tabletop: ["⚀", "⚃", "⚅", "d20"],
};

export default function CollegePageTitle({ collegeId, label, className = "" }) {
  const displayLabel = label || LABELS[collegeId] || collegeId;
  const sigils = SIGILS[collegeId] || [];

  return (
    <h1
      className={`price-page__title college-page-title college-page-title--${collegeId} ${className}`.trim()}
    >
      <span className="college-page-title__mark" aria-hidden="true">
        <span className="college-page-title__halo" />
        <span className="college-page-title__ring" />
        {sigils.map((sigil, index) => (
          <span
            key={`${sigil}-${index}`}
            className={`college-page-title__sigil college-page-title__sigil--${index + 1}`}
          >
            {sigil}
          </span>
        ))}
      </span>
      <span className="college-page-title__emblem">
        <CollegeIcon collegeId={collegeId} size={22} />
      </span>
      <span className="college-page-title__text">{displayLabel}</span>
    </h1>
  );
}
