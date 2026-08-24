// Android equivalent of DesktopUpdateBanner — but this app isn't
// distributed through Play Store, so there's no silent install like
// the desktop updater has. Opening the download URL in the system
// browser (not this app's own webview, which can't reliably drive a
// file download) hands off to Android's own real download manager +
// "tap to install" notification — the same confirmation tap Android
// requires for any sideloaded app regardless of how it got there.
// Android-only, silently does nothing on web/desktop.

import { useEffect, useState } from "react";
import { Browser } from "@capacitor/browser";
import { checkForAndroidUpdate } from "../lib/androidUpdater";
import { isAndroid } from "../lib/platform";

export default function AndroidUpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isAndroid()) return;
    let cancelled = false;
    setCheckError(null);
    checkForAndroidUpdate()
      .then((found) => {
        if (cancelled) return;
        if (found) setUpdate(found);
      })
      .catch((err) => {
        console.error("Android update check failed:", err);
        // Previously silent — logged to a console nobody sees on a
        // real device, so a real failure (rate limit, no connection)
        // looked identical to "no update available" from the outside.
        if (!cancelled) setCheckError(err.message || "Couldn't check for updates.");
      });
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (dismissed) return null;

  if (update) {
    return (
      <div className="desktop-update-banner">
        <div className="desktop-update-banner__body">
          <span className="desktop-update-banner__title">Update available</span>
          <span className="desktop-update-banner__desc">
            Lykodex {update.version} is ready to download. Android will ask you to confirm the install once it's downloaded.
          </span>
        </div>
        <div className="desktop-update-banner__actions">
          <button type="button" className="quickdash-reset-btn" onClick={() => setDismissed(true)}>
            Later
          </button>
          <button type="button" className="price-search__button" onClick={() => Browser.open({ url: update.downloadUrl })}>
            Download
          </button>
        </div>
      </div>
    );
  }

  if (checkError) {
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

  return null;
}
