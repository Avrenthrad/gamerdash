// Small inline avatar for notification/social-feed rows — real
// avatar_url when the profile has one uploaded, else the same
// initial-letter fallback used everywhere else a profile picture can
// be missing (see friend-row__avatar). One shared component so every
// feed (notifications, Guild activity, posts, comments, members)
// renders identically instead of N slightly-different copies.

function initial(profile) {
  const name = profile?.first_name || profile?.username || "?";
  return name.slice(0, 1).toUpperCase();
}

export default function MiniAvatar({ profile }) {
  return (
    <span className="mini-avatar">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" />
      ) : (
        <span aria-hidden="true">{initial(profile)}</span>
      )}
    </span>
  );
}
