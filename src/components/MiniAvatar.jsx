// Small inline avatar for notification/social-feed rows — real
// avatar_url when the profile has one uploaded, else the same
// initial-letter fallback used everywhere else a profile picture can
// be missing (see friend-row__avatar). One shared component so every
// feed (notifications, Guild activity, posts, comments, members)
// renders identically instead of N slightly-different copies.

import { useEffect, useState } from "react";

function initial(profile) {
  const name = profile?.first_name || profile?.username || "?";
  return name.slice(0, 1).toUpperCase();
}

export default function MiniAvatar({ profile }) {
  // A set avatar_url doesn't guarantee the image actually loads (a
  // deleted storage object, a revoked share link, a host that's since
  // gone away) — without this, a broken URL rendered the browser's
  // own broken-image glyph instead of falling back to the initial
  // letter, same bug ProfileHeading.jsx already guards against.
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [profile?.avatar_url]);

  return (
    <span className="mini-avatar">
      {profile?.avatar_url && !broken ? (
        <img src={profile.avatar_url} alt="" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initial(profile)}</span>
      )}
    </span>
  );
}
