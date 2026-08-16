import { API_BASE } from "./apiBase";
// Client-side helper for the Destiny 2 / Bungie OAuth connection.

export async function checkBungieStatus() {
  const res = await fetch(`${API_BASE}/api/bungie?action=status`);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.connected);
}

export function connectBungie() {
  // Full page navigation, not fetch — OAuth has to happen as a real
  // browser redirect to Bungie's login screen.
  window.location.href = `${API_BASE}/api/bungie?action=authorize`;
}

export async function disconnectBungie() {
  await fetch(`${API_BASE}/api/bungie?action=logout`);
}

export async function fetchEververseStore() {
  const res = await fetch(`${API_BASE}/api/bungie`);
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  if (data.error === "not_connected") return "not_connected";
  if (!res.ok) throw new Error(data.error || "Failed to load the Eververse store");
  return data; // { vendorRefreshDate, items: [{ itemHash, quantity, costs }] }
}
