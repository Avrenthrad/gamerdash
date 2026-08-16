/**
 * Current Rotation — the games you're actually playing right now.
 * Pinned strip at the top of the dashboard. Max 4 pins.
 * Persisted in localStorage so it works logged-out too.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "gd-current-rotation";
const MAX_PINS = 4;

function loadPins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}

function savePins(pins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins.slice(0, MAX_PINS)));
  } catch {
    /* ignore */
  }
}

export default function CurrentRotation({
  wishlist = [],
  onOpenBacklog,
  onOpenPrices,
}) {
  const [pins, setPins] = useState(loadPins);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    savePins(pins);
  }, [pins]);

  function pinTitle(title) {
    setPins((prev) => {
      if (prev.includes(title)) return prev;
      if (prev.length >= MAX_PINS) return prev;
      return [...prev, title];
    });
    setPicking(false);
  }

  function unpinTitle(title) {
    setPins((prev) => prev.filter((t) => t !== title));
  }

  const candidates = wishlist
    .map((w) => w.title)
    .filter((t) => !pins.includes(t))
    .slice(0, 12);

  return (
    <section className="current-rotation">
      <div className="current-rotation__head">
        <div>
          <span className="current-rotation__eyebrow">Right now</span>
          <h2 className="current-rotation__title">Current Rotation</h2>
          <p className="current-rotation__subtitle">
            The games you&apos;re actually touching. Everything else can wait.
          </p>
        </div>
        <div className="current-rotation__actions">
          {pins.length < MAX_PINS && wishlist.length > 0 && (
            <button
              type="button"
              className="current-rotation__btn"
              onClick={() => setPicking((v) => !v)}
            >
              {picking ? "Cancel" : "Pin a game"}
            </button>
          )}
          {onOpenBacklog && (
            <button
              type="button"
              className="current-rotation__btn current-rotation__btn--ghost"
              onClick={onOpenBacklog}
            >
              Backlog
            </button>
          )}
        </div>
      </div>

      {picking && (
        <div className="current-rotation__picker">
          {candidates.length === 0 ? (
            <p className="current-rotation__empty-hint">
              Nothing left to pin from your wishlist.{" "}
              {onOpenPrices && (
                <button type="button" className="linkish" onClick={onOpenPrices}>
                  Add games first →
                </button>
              )}
            </p>
          ) : (
            <ul className="current-rotation__picker-list">
              {candidates.map((title) => (
                <li key={title}>
                  <button
                    type="button"
                    className="current-rotation__picker-item"
                    onClick={() => pinTitle(title)}
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pins.length === 0 ? (
        <div className="current-rotation__empty">
          <p>
            Your rotation is empty. Pin up to {MAX_PINS} games you&apos;re actually playing
            so the dashboard stops pretending your entire library is &quot;active.&quot;
          </p>
          {wishlist.length > 0 ? (
            <button
              type="button"
              className="current-rotation__btn"
              onClick={() => setPicking(true)}
            >
              Pin from wishlist
            </button>
          ) : (
            onOpenPrices && (
              <button type="button" className="current-rotation__btn" onClick={onOpenPrices}>
                Build a wishlist first →
              </button>
            )
          )}
        </div>
      ) : (
        <ul className="current-rotation__grid">
          {pins.map((title) => (
            <li key={title} className="current-rotation__card">
              <span className="current-rotation__card-title">{title}</span>
              <button
                type="button"
                className="current-rotation__unpin"
                onClick={() => unpinTitle(title)}
                title="Remove from rotation"
                aria-label={`Unpin ${title}`}
              >
                ×
              </button>
            </li>
          ))}
          {Array.from({ length: MAX_PINS - pins.length }).map((_, i) => (
            <li key={`slot-${i}`} className="current-rotation__card current-rotation__card--empty">
              <button
                type="button"
                className="current-rotation__slot"
                onClick={() => setPicking(true)}
                disabled={wishlist.length === 0}
              >
                + Pin
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
