// Public profile URLs for linked gaming accounts — same destinations
// verified in AccountLinkingPage.jsx (not guessed vanity paths).

export function steamProfileUrl(steamId) {
  if (!steamId) return null;
  return `https://steamcommunity.com/profiles/${steamId}`;
}

export function xboxProfileUrl(gamertag) {
  if (!gamertag) return null;
  return `https://account.xbox.com/en-us/profile?gamertag=${encodeURIComponent(gamertag)}`;
}

export function playstationProfileUrl() {
  return "https://library.playstation.com";
}
