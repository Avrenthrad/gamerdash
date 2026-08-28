// Gaming dashboard hero card — auto-rotates between two real slides:
// "Last Played" (live status if currently playing, else the best real
// recency proxy Steam offers) and "Most Played This Week" (real
// playtime_2weeks data). See lib/friendsData.js's
// fetchContinuePlayingSlides for exactly what each slide means and why
// there's no true last-played timestamp involved.

import { useEffect, useState } from "react";
import { fetchContinuePlayingSlides } from "../lib/friendsData";
import { steamHeaderArt } from "../lib/steam";

const ROTATE_MS = 7000;

export default function ContinuePlayingCard({ linkedSteamId, onOpenLibrary }) {
  const [slides, setSlides] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!linkedSteamId) return;
    setStatus("loading");
    fetchContinuePlayingSlides(linkedSteamId)
      .then((result) => {
        setSlides(result);
        setSlideIndex(0);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Continue Playing fetch failed:", err);
        setStatus("error");
      });
  }, [linkedSteamId]);

  useEffect(() => {
    if (slides.length < 2) return;
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [slides.length]);

  const slide = slides[slideIndex];

  return (
    <div className="panel hero-card hero-card--continue-playing">
      <div className="panel__head">
        <span className="panel__eyebrow">{slide ? slide.label : "Continue Playing"}</span>
        {slides.length > 1 && (
          <div className="hero-card__dots">
            {slides.map((s, i) => (
              <button
                key={s.label}
                type="button"
                className={`hero-card__dot ${i === slideIndex ? "hero-card__dot--active" : ""}`}
                onClick={() => setSlideIndex(i)}
                aria-label={`Show ${s.label}`}
              />
            ))}
          </div>
        )}
      </div>

      {!linkedSteamId && (
        <p className="panel__status">Link Steam to see what you're playing here.</p>
      )}
      {linkedSteamId && status === "loading" && <p className="panel__status">Loading…</p>}
      {linkedSteamId && status === "error" && (
        <p className="panel__status panel__status--error">Couldn't load your progress right now.</p>
      )}
      {linkedSteamId && status === "ready" && slides.length === 0 && (
        <p className="panel__status">No owned games visible on this Steam profile.</p>
      )}

      {linkedSteamId && status === "ready" && slide && (
        <button type="button" className="hero-card__art-btn" onClick={onOpenLibrary} key={slide.label}>
          <img src={steamHeaderArt(slide.appid)} alt="" className="hero-card__art" decoding="async" />
          <div className="hero-card__art-overlay">
            <span className="hero-card__title">{slide.gameName}</span>
            {slide.isCurrentlyPlaying && (
              <span className="own-progress-row__live">● Playing now</span>
            )}
          </div>
        </button>
      )}

      {linkedSteamId && status === "ready" && slide && (
        <>
          {slide.completionPct != null && (
            <div className="friend-row__progress-bar">
              <div className="friend-row__progress-fill" style={{ width: `${slide.completionPct}%` }} />
            </div>
          )}
          <div className="panel__stat-row">
            {slide.completionPct != null && (
              <div className="panel__stat">
                <span className="panel__stat-value">{slide.completionPct}%</span>
                <span className="panel__stat-label">Achievements</span>
              </div>
            )}
            {!slide.isCurrentlyPlaying && (
              <div className="panel__stat">
                <span className="panel__stat-value">{slide.statHours}h</span>
                <span className="panel__stat-label">{slide.statLabel}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
