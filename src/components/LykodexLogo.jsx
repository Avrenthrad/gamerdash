// Shared logo component — replaces three separate direct imports of
// assets/logo.png (Header, LoginPage, ErrorBoundary) with one
// reusable component, so the brand mark only needs to be swapped in
// one place if it ever changes again.
//
// Deliberately doesn't set its own size — each usage already has a
// specific CSS class controlling sizing/positioning for its context
// (header mark vs. login card vs. crash screen), so this just passes
// className straight through rather than fighting those with inline
// styles.

import logo from "../assets/logo.png";

export default function LykodexLogo({ className = "", alt = "Lykodex" }) {
  return <img src={logo} alt={alt} className={className} />;
}
