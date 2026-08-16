// Reusable wishlist add/remove control.
// Not on the wishlist  -> heart icon, turns green on hover, click adds.
// Already on the wishlist -> "✕" icon, turns red on hover, click removes.
//
// Wishlist actions require an account (browsing Prices itself doesn't —
// that stays open so people can look around first). When logged out,
// clicking either icon shows a small popover asking to sign in/create
// an account instead of silently performing the action.

import { useState } from "react";
import { AccountGatePopover } from "./AccountGate";

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 21s-7.5-4.6-10-9.1C.4 8.6 1.7 5 5.1 4.1 7.4 3.5 9.7 4.4 12 6.9c2.3-2.5 4.6-3.4 6.9-2.8 3.4.9 4.7 4.5 3.1 7.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export default function WishlistToggle({ isWishlisted, onAdd, onRemove, isLoggedIn = true, onSignIn, onCreateAccount }) {
  const [showGate, setShowGate] = useState(false);

  function handleClick() {
    if (!isLoggedIn) {
      setShowGate(true);
      return;
    }
    if (isWishlisted) {
      onRemove();
    } else {
      onAdd();
    }
  }

  return (
    <div className="wishlist-toggle-wrap">
      {isWishlisted ? (
        <button
          type="button"
          className="wishlist-toggle wishlist-toggle--remove"
          onClick={handleClick}
          aria-label="Remove from wishlist"
          title="Remove from wishlist"
        >
          <XIcon />
        </button>
      ) : (
        <button
          type="button"
          className="wishlist-toggle wishlist-toggle--add"
          onClick={handleClick}
          aria-label="Add to wishlist"
          title="Add to wishlist"
        >
          <HeartIcon />
        </button>
      )}

      {showGate && (
        <AccountGatePopover
          message="You'll need an account to save games to your wishlist."
          onSignIn={onSignIn}
          onCreateAccount={onCreateAccount}
          onDismiss={() => setShowGate(false)}
        />
      )}
    </div>
  );
}
