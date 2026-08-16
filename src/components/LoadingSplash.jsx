// One-time boot animation — logo animates and "lights up" on first
// load or a refresh (Discord-style branded loading moment). Only
// ever mounts once per real page load, since it's driven from App's
// own mount, not from internal hash navigation — so it won't replay
// every time you click around the site, only on an actual page
// load/refresh.
//
// Uses the real animated brand mark (loading.gif) rather than a
// CSS-driven spin on the static logo — the gif already has its own
// built-in motion, so the old spin/rotate animation was removed
// rather than layering a second, conflicting animation on top of it.
// The complementary red glow pulse around it stays.

import loadingGif from "../assets/loading.gif";

export default function LoadingSplash({ fadingOut }) {
  return (
    <div className={`loading-splash ${fadingOut ? "loading-splash--fade" : ""}`} aria-hidden="true">
      <div className="loading-splash__glow">
        <img src={loadingGif} alt="" className="loading-splash__logo" />
      </div>
    </div>
  );
}
