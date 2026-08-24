// Manual "Check for updates" entry at the bottom of the account
// drawer — packaged apps only (desktop Tauri, mobile Capacitor), a
// no-op on the plain website. Exists alongside the automatic
// startup check (DesktopUpdateBanner/AndroidUpdateBanner in App.jsx),
// not instead of it — this is for someone who wants to force a fresh
// check right now rather than wait for next launch, and to make the
// result visible in-place instead of only in a console nobody reads
// on a real device.
import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { isTauri, isAndroid, isPackagedApp } from "../lib/platform";
import { checkForDesktopUpdate, installDesktopUpdate } from "../lib/updater";
import { checkForAndroidUpdate } from "../lib/androidUpdater";

export default function UpdateCheckMenuItem() {
  const [status, setStatus] = useState("idle"); // idle | checking | up-to-date | available | installing | error
  const [update, setUpdate] = useState(null);
  const [message, setMessage] = useState("");

  if (!isPackagedApp()) return null;

  async function handleCheck() {
    setStatus("checking");
    setMessage("");
    setUpdate(null);
    try {
      const found = isTauri() ? await checkForDesktopUpdate() : await checkForAndroidUpdate();
      if (found) {
        setUpdate(found);
        setStatus("available");
      } else {
        setStatus("up-to-date");
      }
    } catch (err) {
      console.error("Manual update check failed:", err);
      setStatus("error");
      setMessage(err.message || "Couldn't check for updates.");
    }
  }

  async function handleAction() {
    if (!update) return;
    if (isTauri()) {
      setStatus("installing");
      try {
        await installDesktopUpdate(update);
        // installDesktopUpdate relaunches the app on success — nothing
        // left to do here if it resolves.
      } catch (err) {
        console.error("Update install failed:", err);
        setStatus("error");
        setMessage("Couldn't install — try again.");
      }
    } else if (isAndroid()) {
      Browser.open({ url: update.downloadUrl });
    }
  }

  return (
    <>
      <div className="dash-drawer__divider" />
      <button
        type="button"
        className="dash-drawer__item"
        onClick={handleCheck}
        disabled={status === "checking" || status === "installing"}
      >
        {status === "checking"
          ? "Checking for updates…"
          : status === "installing"
            ? "Installing…"
            : "Check for updates"}
      </button>

      {status === "up-to-date" && <p className="panel__status">You're on the latest version.</p>}
      {status === "error" && <p className="panel__status panel__status--error">{message}</p>}
      {status === "available" && update && (
        <div className="backlog-add">
          <p className="panel__status">Lykodex {update.version} is available.</p>
          <button type="button" className="linking-row__connect" onClick={handleAction}>
            {isTauri() ? "Update & Restart" : "Download"}
          </button>
        </div>
      )}
    </>
  );
}
