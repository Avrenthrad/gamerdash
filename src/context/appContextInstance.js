// The raw React context object, split out from AppContext.jsx (which
// still defines and exports the AppProvider component) and from
// hooks/useApp.js (which still defines and exports the useApp hook) —
// Vite's Fast Refresh needs every exporting file to be either
// component-only or hook/constant-only, not a mix, or it falls back
// to a full-page reload on every edit instead of a hot swap.
import { createContext } from "react";

export const AppContext = createContext(null);
