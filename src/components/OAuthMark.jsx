// Small brand marks for OAuth buttons. Inline SVGs so we don't pull
// a whole icon pack for five logos. currentColor so the button CSS
// owns the tint.

export default function OAuthMark({ provider }) {
  switch (provider) {
    case "discord":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.27 5.33A17.4 17.4 0 0 0 14.89 4c-.2.36-.43.85-.59 1.23a16.1 16.1 0 0 0-4.6 0A11.4 11.4 0 0 0 9.1 4a17.2 17.2 0 0 0-4.39 1.35C1.85 9.14.96 12.83 1.2 16.47A17.6 17.6 0 0 0 6.7 19c.36-.5.68-1.03.96-1.58a11.4 11.4 0 0 1-1.52-.74c.13-.09.25-.19.37-.28 2.92 1.37 6.08 1.37 8.97 0 .12.1.24.19.37.28-.49.3-1 .55-1.52.74.28.55.6 1.08.96 1.58a17.5 17.5 0 0 0 5.5-2.53c.28-4.27-.47-7.92-2.52-11.14ZM8.7 14.6c-.88 0-1.6-.82-1.6-1.83s.7-1.83 1.6-1.83 1.62.83 1.6 1.83c0 1-.71 1.83-1.6 1.83Zm6.6 0c-.88 0-1.6-.82-1.6-1.83s.7-1.83 1.6-1.83 1.62.83 1.6 1.83c0 1-.7 1.83-1.6 1.83Z"
          />
        </svg>
      );
    case "twitch":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 3h16v11.2L16.4 21H12l-2.4 2.4H7.2V21H4V3Zm2.4 2.4v12h3.2v2.4l2.4-2.4h3.2L18 14.2V5.4H6.4Zm6.4 7.2H15V8.2h-2.2v4.4Zm-4.4 0h2.2V8.2H8.4v4.4Z"
          />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42Z"
            opacity="0.95"
          />
          <path
            fill="currentColor"
            d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.23-2.5c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A10 10 0 0 0 12 22Z"
            opacity="0.75"
          />
          <path
            fill="currentColor"
            d="M6.39 13.98A6 6 0 0 1 6.07 12c0-.69.12-1.35.32-1.98V7.44H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.56l3.33-2.58Z"
            opacity="0.85"
          />
          <path
            fill="currentColor"
            d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.96 2.97 14.7 2 12 2A10 10 0 0 0 3.06 7.44l3.33 2.58C7.18 7.72 9.39 5.96 12 5.96Z"
            opacity="0.7"
          />
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16.7 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9s-1.9-.9-3.2-.8c-1.6.1-3.1 1-3.9 2.5-1.7 2.9-.4 7.2 1.2 9.6.8 1.1 1.7 2.4 3 2.4 1.2 0 1.6-.7 3.1-.7s1.8.7 3.1.7 2.1-1.2 2.9-2.4c.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8Zm-2.3-6.7c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.3Z"
          />
        </svg>
      );
    case "azure":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M11.4 3H3v8.4h8.4V3Z" opacity="0.95" />
          <path fill="currentColor" d="M21 3h-8.4v8.4H21V3Z" opacity="0.7" />
          <path fill="currentColor" d="M11.4 12.6H3V21h8.4v-8.4Z" opacity="0.7" />
          <path fill="currentColor" d="M21 12.6h-8.4V21H21v-8.4Z" opacity="0.95" />
        </svg>
      );
    default:
      return null;
  }
}
