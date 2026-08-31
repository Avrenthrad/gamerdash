// Left sidebar shown while inside a College — real links to that
// college's built pages. Shared shell for Gaming, TCG, Library, Loot,
// and Wartable; see lib/navSections.js for per-college item lists.

import CollegeIcon from "./CollegeIcon";

function ChevronIcon({ direction = "left" }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}

export default function CollegeSidebar({
  collegeId,
  label,
  items,
  currentView,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}) {
  const navLabel = label || collegeId;

  if (collapsed) {
    return (
      <button
        type="button"
        className="dash-rail-toggle dash-rail-toggle--left"
        onClick={onToggleCollapsed}
        aria-label={`Show ${navLabel} navigation`}
        title={`Show ${navLabel} navigation`}
      >
        <ChevronIcon direction="right" />
      </button>
    );
  }

  return (
    <aside className={`college-sidebar college-sidebar--${collegeId}`}>
      <div className="college-sidebar__head">
        <span className="college-sidebar__label">
          <CollegeIcon collegeId={collegeId} size={16} />
          {navLabel}
        </span>
        <button
          type="button"
          className="college-sidebar__toggle"
          onClick={onToggleCollapsed}
          aria-label={`Hide ${navLabel} navigation`}
          title="Hide navigation"
        >
          <ChevronIcon direction="left" />
        </button>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`college-sidebar__item ${currentView === item.id ? "college-sidebar__item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </aside>
  );
}
