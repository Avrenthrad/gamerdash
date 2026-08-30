/**
 * Current Rotation — the games you're actually playing right now.
 * Pinned strip at the top of the dashboard. Max 4 pins.
 * Persisted in localStorage so it works logged-out too.
 *
 * Pin suggestions come from two real sources: Steam's own real
 * playtime_2weeks window (same recency signal ContinuePlayingCard/
 * fetchContinuePlayingSlides already uses — "recently played" isn't
 * a guessed proxy) offered first as the default, and the wishlist as
 * a fallback/supplement.
 *
 * Once there's both a real Rotation and real backlog data, the card
 * auto-cycles between the two every ROTATE_MS, same dot-indicator
 * pattern as ContinuePlayingCard — never cycles to an empty backlog.
 */

import { useEffect, useState } from "react";
import { fetchOwnedGames } from "../lib/steam";
import { fetchBacklog, STATUS_LABELS } from "../lib/backlog";

const STORAGE_KEY = "gd-current-rotation";
const MAX_PINS = 4;
const ROTATE_MS = 8000;

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
  linkedSteamId,
  userId,
  onOpenBacklog,
  onOpenPrices,
}) {
  const [pins, setPins] = useState(loadPins);
  const [picking, setPicking] = useState(false);
  const [recentGames, setRecentGames] = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [previewMode, setPreviewMode] = useState(0); // 0 = Rotation, 1 = Backlog preview

  useEffect(() => {
    savePins(pins);
  }, [pins]);

  useEffect(() => {
    if (!linkedSteamId) return;
    fetchOwnedGames(linkedSteamId)
      .then((games) => {
        const recent = games
          .filter((g) => (g.playtime_2weeks || 0) > 0)
          .sort((a, b) => (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0))
          .slice(0, 8)
          .map((g) => g.name);
        setRecentGames(recent);
      })
      .catch((err) => console.error("Failed to load recently played games:", err));
  }, [linkedSteamId]);

  useEffect(() => {
    if (!userId) return;
    fetchBacklog(userId)
      .then((items) => {
        const active = items.filter((i) => {
          const s = i.status || "backlog";
          return s !== "completed" && s !== "dropped";
        });
        setBacklogItems(active.slice(0, 5));
      })
      .catch((err) => console.error("Failed to load backlog preview:", err));
  }, [userId]);

  useEffect(() => {
    if (pins.length === 0 || backlogItems.length === 0) return;
    const interval = setInterval(() => setPreviewMode((m) => (m + 1) % 2), ROTATE_MS);
    return () => clearInterval(interval);
  }, [pins.length, backlogItems.length]);

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

  const recentCandidates = recentGames.filter((t) => !pins.includes(t));
  const wishlistCandidates = wishlist
    .map((w) => w.title)
    .filter((t) => !pins.includes(t) && !recentCandidates.includes(t))
    .slice(0, 12);
  const hasCandidates = recentCandidates.length > 0 || wishlistCandidates.length > 0;

  const showBacklogPreview = pins.length > 0 && backlogItems.length > 0 && previewMode === 1;

  return (
    <section className="current-rotation">
      <div className="current-rotation__head">
        <div>
          <span className="current-rotation__eyebrow">Right now</span>
          <h2 className="current-rotation__title">
            {showBacklogPreview ? "From Your Backlog" : "Current Rotation"}
          </h2>
        </div>
        <div className="current-rotation__actions">
          {pins.length > 0 && backlogItems.length > 0 && (
            <div className="hero-card__dots">
              {["Rotation", "Backlog"].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`hero-card__dot ${previewMode === i ? "hero-card__dot--active" : ""}`}
                  onClick={() => setPreviewMode(i)}
                  aria-label={`Show ${label}`}
                />
              ))}
            </div>
          )}
          {pins.length < MAX_PINS && hasCandidates && (
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
          {!hasCandidates ? (
            <p className="current-rotation__empty-hint">
              Nothing left to pin — link Steam or add to your wishlist first.{" "}
              {onOpenPrices && (
                <button type="button" className="linkish" onClick={onOpenPrices}>
                  Add games →
                </button>
              )}
            </p>
          ) : (
            <>
              {recentCandidates.length > 0 && (
                <>
                  <span className="feed-col__label">Recently played</span>
                  <ul className="current-rotation__picker-list">
                    {recentCandidates.map((title) => (
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
                </>
              )}
              {wishlistCandidates.length > 0 && (
                <>
                  <span className="feed-col__label">From your wishlist</span>
                  <ul className="current-rotation__picker-list">
                    {wishlistCandidates.map((title) => (
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
                </>
              )}
            </>
          )}
        </div>
      )}

      {pins.length === 0 ? (
        <div className="current-rotation__empty">
          <p>
            Your rotation is empty. Pin up to {MAX_PINS} games you&apos;re actually playing
            so the dashboard stops pretending your entire library is &quot;active.&quot;
          </p>
          {hasCandidates ? (
            <button
              type="button"
              className="current-rotation__btn"
              onClick={() => setPicking(true)}
            >
              Pin a game
            </button>
          ) : (
            onOpenPrices && (
              <button type="button" className="current-rotation__btn" onClick={onOpenPrices}>
                Build a wishlist first →
              </button>
            )
          )}
        </div>
      ) : showBacklogPreview ? (
        <ul className="current-rotation__grid">
          {backlogItems.map((item) => (
            <li key={item.id} className="current-rotation__card">
              <span className="current-rotation__card-title">{item.title}</span>
              <span className="label-chip">{STATUS_LABELS[item.status || "backlog"]}</span>
            </li>
          ))}
        </ul>
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
                disabled={!hasCandidates}
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
