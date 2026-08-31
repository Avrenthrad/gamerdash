// Backwards-compatible Gaming College wrapper — App.jsx uses
// CollegeSidebar directly for all colleges now.

import CollegeSidebar from "./CollegeSidebar";
import { GAMING_SIDEBAR_ITEMS } from "../lib/navSections";

export default function GamingSidebar(props) {
  return (
    <CollegeSidebar
      collegeId="gaming"
      label="Gaming"
      items={GAMING_SIDEBAR_ITEMS}
      {...props}
    />
  );
}
