// Resolve Twitch / YouTube URLs from profile_details saved in Account Settings.

function normalizeUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function cleanHandle(raw) {
  return String(raw || "").trim().replace(/^@+/, "");
}

export function twitchProfileUrl(profileDetails) {
  const links = profileDetails?.streamLinks || {};
  const values = profileDetails?.streamValues || {};

  if (links.twitch?.trim()) return normalizeUrl(links.twitch);

  const handle = cleanHandle(values.twitch);
  if (!handle) return null;
  return `https://twitch.tv/${encodeURIComponent(handle)}`;
}

export function youtubeProfileUrl(profileDetails) {
  const links = profileDetails?.streamLinks || {};
  const values = profileDetails?.streamValues || {};

  if (links.youtube?.trim()) return normalizeUrl(links.youtube);

  const raw = String(values.youtube || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return normalizeUrl(raw);

  const handle = raw.startsWith("@") ? raw : `@${cleanHandle(raw)}`;
  return `https://www.youtube.com/${handle}`;
}

export function getProfileStreamQuickLinks(profileDetails) {
  const links = [];

  const twitch = twitchProfileUrl(profileDetails);
  if (twitch) {
    links.push({
      id: "profile-twitch",
      label: "Your Twitch channel",
      href: twitch,
      icon: "/icons/community/twitch.svg",
      placeholder: false,
    });
  }

  const youtube = youtubeProfileUrl(profileDetails);
  if (youtube) {
    links.push({
      id: "profile-youtube",
      label: "Your YouTube channel",
      href: youtube,
      icon: "/icons/community/youtube.svg",
      placeholder: false,
    });
  }

  return links;
}
