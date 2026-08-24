// One-time upfront permission request for the mobile app — Camera and
// Location, requested together on first launch rather than waiting
// for a feature to ask reactively (Live Scan is the only thing that
// currently reads camera data; nothing reads real location yet, asked
// for anyway per product decision — not because a feature needs it).
//
// Both already have working runtime-permission plumbing via
// Capacitor's own BridgeWebChromeClient: onPermissionRequest grants
// getUserMedia's camera request, onGeolocationPermissionsShowPrompt
// grants navigator.geolocation's request — see AndroidManifest.xml's
// CAMERA/ACCESS_*_LOCATION entries for the manifest half of that. This
// file just triggers each once, instead of only on first real use.
//
// Network access (INTERNET) isn't requested here — Android grants it
// silently at install time and never shows a runtime prompt for it,
// regardless of what any app does.
import { isMobileApp } from "./platform";

const STORAGE_KEY = "lykodex-permissions-requested";

function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      // Only here to trigger the OS permission prompt — not actually
      // using the feed, so stop it immediately rather than leaving a
      // hidden camera session (and its status-bar indicator) running.
      stream.getTracks().forEach((t) => t.stop());
    })
    .catch((err) => {
      // Denied or no camera — nothing to do here. Live Scan surfaces
      // its own "Couldn't access your camera" state if tried later.
      console.warn("Camera permission request failed:", err);
    });
}

function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    () => {},
    (err) => console.warn("Location permission request failed:", err),
    { timeout: 5000 }
  );
}

export function requestUpfrontPermissions() {
  if (!isMobileApp()) return;
  if (localStorage.getItem(STORAGE_KEY)) return;
  localStorage.setItem(STORAGE_KEY, "1");
  requestCamera();
  requestLocation();
}
