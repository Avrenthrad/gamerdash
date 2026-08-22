// Desktop auto-update — checks the signed manifest the release
// workflow publishes to GitHub Releases (see tauri.conf.json's
// plugins.updater.endpoints and .github/workflows/release.yml).
// Tauri-only: the mobile builds go through their app stores instead.

import { isTauri } from "./platform";

export async function checkForDesktopUpdate() {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  return update?.available ? update : null;
}

export async function installDesktopUpdate(update) {
  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
