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

  // GitHub's /releases list is NOT reliably ordered newest-first —
  // confirmed live: with both this workflow and release-desktop.yml
  // publishing releases in the same repo, android-v0.1.9's entry
  // sorted ahead of android-v0.1.10 through .13 in this same array.
  // The old code took releases.find()'s first match, which silently
  // locked the update check onto that stale release for hours — every
  // device already past 0.1.9 (i.e. everyone) saw "no update"
  // regardless of how many real releases shipped after it. Compare
  // every android-v release's actual version number instead of
  // trusting array order.
  const androidReleases = releases.filter((r) => r.tag_name.startsWith("android-v") && !r.draft);
  if (androidReleases.length === 0) return null;

  const latestRelease = androidReleases.reduce((best, r) => {
    if (!best) return r;
    const candidate = r.tag_name.replace("android-v", "");
    const bestVersion = best.tag_name.replace("android-v", "");
    return isNewerVersion(candidate, bestVersion) ? r : best;
  }, null);

  const latestVersion = latestRelease.tag_name.replace("android-v", "");
  if (!isNewerVersion(latestVersion, currentVersion)) return null;

  const apkAsset = latestRelease.assets.find((a) => a.name.endsWith(".apk"));
  if (!apkAsset) return null;

  return { version: latestVersion, downloadUrl: apkAsset.browser_download_url };
}
