// Left sidebar shown only while inside the Gaming College — real
// links to Gaming's actual, already-built pages. Not a new nav
// system, just surfacing existing routes in the new College-shell
// structure. See Header.jsx for GAMING_SIDEBAR_ITEMS/GAMING_VIEWS.

import { GAMING_SIDEBAR_ITEMS } from "./Header";
import CollegeIcon from "./CollegeIcon";

export default function GamingSidebar({ currentView, onNavigate }) {
  return (
    <aside className="gaming-sidebar">
      <span className="gaming-sidebar__label">
        <CollegeIcon collegeId="gaming" size={16} />
        Gaming
      </span>
      {GAMING_SIDEBAR_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`gaming-sidebar__item ${currentView === item.id ? "gaming-sidebar__item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </aside>
  );
}
