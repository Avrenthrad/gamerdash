// A new version being live on GitHub Releases doesn't reach an
// already-installed desktop copy by itself — this is what actually
// closes that gap: checks the signed manifest once per launch (see
// lib/updater.js) and offers to install if one's found. Tauri-only,
// silently does nothing on web/mobile.

import { useEffect, useState } from "react";
import { checkForDesktopUpdate, installDesktopUpdate } from "../lib/updater";
import { isTauri } from "../lib/platform";

export default function DesktopUpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | installing | error
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    checkForDesktopUpdate()
      .then((found) => {
        if (found) setUpdate(found);
      })
      .catch((err) => console.error("Desktop update check failed:", err));
  }, []);

  if (!update || dismissed) return null;

  async function handleInstall() {
    setStatus("installing");
    try {
      await installDesktopUpdate(update);
      // installDesktopUpdate relaunches the app on success — nothing
      // left to do here if it resolves.
    } catch (err) {
      console.error("Desktop update install failed:", err);
      setStatus("error");
    }
  }

  return (
    <div className="desktop-update-banner">
      <div className="desktop-update-banner__body">
        <span className="desktop-update-banner__title">Update available</span>
        <span className="desktop-update-banner__desc">
          Lykodex {update.version} is ready to install.
          {status === "error" && " Couldn't install — try again."}
        </span>
      </div>
      <div className="desktop-update-banner__actions">
        <button type="button" className="quickdash-reset-btn" onClick={() => setDismissed(true)} disabled={status === "installing"}>
          Later
        </button>
        <button type="button" className="price-search__button" onClick={handleInstall} disabled={status === "installing"}>
          {status === "installing" ? "Installing…" : "Update & Restart"}
        </button>
      </div>
    </div>
  );
}
