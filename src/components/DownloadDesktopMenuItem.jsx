// "Download desktop app" entry in the account drawer — plain website
// only (the opposite gate from UpdateCheckMenuItem, which is packaged-
// apps-only); no point offering someone already inside the desktop
// app a link to install it.
//
// The installer's own filename embeds its version number
// (Lykodex_0.1.NN_x64-setup.exe — see .github/workflows/
// release-desktop.yml), which changes on every release, so there's no
// stable static URL to just link to directly. Fetching GitHub's own
// "latest release" API at click time and finding the real .exe asset
// there is what actually stays correct release over release, instead
// of a hardcoded link quietly going stale the next time a build ships.
// This repo is public (confirmed live), so the unauthenticated GitHub
// API + the asset's own download URL both just work, no token needed.

import { useState } from "react";
import { isPackagedApp } from "../lib/platform";

const LATEST_RELEASE_API = "https://api.github.com/repos/Avrenthrad/lykodex/releases/latest";

export default function DownloadDesktopMenuItem() {
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [message, setMessage] = useState("");

  if (isPackagedApp()) return null;

  async function handleDownload() {
    setStatus("checking");
    setMessage("");
    try {
      const res = await fetch(LATEST_RELEASE_API);
      if (!res.ok) throw new Error("Couldn't reach the releases page right now.");
      const data = await res.json();
      const asset = (data.assets || []).find((a) => a.name.endsWith("_x64-setup.exe"));
      if (!asset) throw new Error("Couldn't find the Windows installer in the latest release.");
      window.open(asset.browser_download_url, "_blank", "noopener,noreferrer");
      setStatus("idle");
    } catch (err) {
      console.error("Failed to fetch the latest desktop release:", err);
      setStatus("error");
      setMessage(err.message || "Couldn't start the download — try again in a moment.");
    }
  }

  return (
    <>
      <button
        type="button"
        className="dash-drawer__item"
        onClick={handleDownload}
        disabled={status === "checking"}
      >
        {status === "checking" ? "Finding latest version…" : "Download desktop app (Windows)"}
      </button>
      {status === "error" && <p className="panel__status panel__status--error">{message}</p>}
    </>
  );
}
