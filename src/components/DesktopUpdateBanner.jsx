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
  const [checkError, setCheckError] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    setCheckError(null);
    checkForDesktopUpdate()
      .then((found) => {
        if (cancelled) return;
        if (found) setUpdate(found);
      })
      .catch((err) => {
        console.error("Desktop update check failed:", err);
        // Previously silent — logged to a console nobody's watching on
        // a real install, so a genuine failure (network down, a
        // malformed manifest) looked identical to "no update
        // available" from the outside.
        if (!cancelled) setCheckError(err.message || "Couldn't check for updates.");
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (dismissed) return null;

  if (!update && checkError) {
    return (
      <div className="desktop-update-banner">
        <div className="desktop-update-banner__body">
          <span className="desktop-update-banner__title">Update check failed</span>
          <span className="desktop-update-banner__desc">{checkError}</span>
        </div>
        <div className="desktop-update-banner__actions">
          <button type="button" className="quickdash-reset-btn" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
          <button type="button" className="price-search__button" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!update) return null;

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
