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
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAndroid()) return;
    checkForAndroidUpdate()
      .then((found) => {
        if (found) setUpdate(found);
      })
      .catch((err) => console.error("Android update check failed:", err));
  }, []);

  if (!update || dismissed) return null;

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
