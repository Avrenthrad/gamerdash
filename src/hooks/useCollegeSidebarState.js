// Persisted open/collapsed state for each college left-rail drawer.

import { useEffect, useState } from "react";

export function useCollegeSidebarState(collegeId) {
  const storageKey = collegeId ? `gd-${collegeId}-sidebar-open` : null;

  const [open, setOpen] = useState(() => {
    if (!storageKey) return true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return true;
      return saved === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === "1");
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [storageKey, open]);

  return [open, setOpen];
}
