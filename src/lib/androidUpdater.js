// Android auto-update check — this app isn't distributed through the
// Play Store (which would handle updates on its own), so this is the
// honest equivalent for a sideloaded install: check whether a newer
// signed release exists, and if so, hand the person to a real
// tap-through install rather than pretend to update silently. Android
// itself requires that confirmation tap for any installed-outside-
// Play-Store app — there's no way around it short of actually
// publishing to Play Store or running as a device-owner-managed app.
//
// Reads GitHub's own Releases API directly (no custom manifest file to
// maintain, unlike the desktop updater's signed latest.json) — the
// release workflow (.github/workflows/release-android.yml) tags each
// build android-v<version> with the signed APK attached.

import { App } from "@capacitor/app";
import { isAndroid } from "./platform";

const REPO = "Avrenthrad/gamerdash";

function isNewerVersion(candidate, current) {
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function checkForAndroidUpdate() {
  if (!isAndroid()) return null;

  const info = await App.getInfo();
  const currentVersion = info.version;

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases`);
  if (!res.ok) {
    // GitHub's unauthenticated REST API allows 60 requests/hour per
    // source IP — plausible to hit while actively testing (relaunching
    // the app repeatedly triggers a fresh check each time). Worth
    // surfacing distinctly from a generic network failure since the
    // fix ("wait") is different from "check your connection".
    const rateLimited = res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
    throw new Error(
      rateLimited
        ? "GitHub's update check is rate-limited right now — try again in a bit."
        : `GitHub releases check failed: ${res.status}`
    );
  }
  const releases = await res.json();

  const androidRelease = releases.find((r) => r.tag_name.startsWith("android-v") && !r.draft);
  if (!androidRelease) return null;

  const latestVersion = androidRelease.tag_name.replace("android-v", "");
  if (!isNewerVersion(latestVersion, currentVersion)) return null;

  const apkAsset = androidRelease.assets.find((a) => a.name.endsWith(".apk"));
  if (!apkAsset) return null;

  return { version: latestVersion, downloadUrl: apkAsset.browser_download_url };
}
