// Layout-only wrapper — no data logic. Renders children inside a lane
// that's a no-op on desktop (children keep whatever layout the page
// already gives them via `className`) and becomes a horizontal-scroll
// row only at the existing mobile breakpoint — same CSS-only,
// no-JS-branching convention as the mobile-tab-bar/drawer in
// Header.jsx. `label` renders as a small section title, mobile-only
// (hidden on desktop so this never adds new visible text there).
export default function HorizontalLane({ label, className, children }) {
  return (
    <div className="h-lane-wrap">
      {label && <p className="h-lane-title">{label}</p>}
      <div className={`h-lane${className ? ` ${className}` : ""}`}>
        {children}
      </div>
    </div>
  );
}
