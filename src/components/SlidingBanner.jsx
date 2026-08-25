// Generic auto-rotating single-item banner — shows one item at a
// time, cross-fading to the next on a timer. Same hold/fade state
// machine as CollegeMorphHero.jsx's crossfade (proven pattern: hold,
// fade out, advance, fade in), generalized here so both
// SteamPresenceCard and GuildPulseCard can share it instead of each
// re-implementing their own timer.
//
// Deliberately dumb about content — it just holds an index and calls
// renderItem(item, index); callers own what a "slide" looks like.

import { useEffect, useRef, useState } from "react";

const HOLD_MS = 3600;
const FADE_MS = 380;

export default function SlidingBanner({ items, renderItem, emptyState = null, className = "" }) {
  const [index, setIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Clamp whenever the underlying list shrinks (e.g. a friend went
  // offline and dropped out) so index never points past the end.
  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  useEffect(() => {
    if (reducedMotion || !visible || paused || items.length < 2) return;
    if (!fadeOut) {
      const t = setTimeout(() => setFadeOut(true), HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadeOut, reducedMotion, visible, paused, items.length]);

  if (items.length === 0) return emptyState;

  const item = items[index] || items[0];

  return (
    <div
      ref={containerRef}
      className={`sliding-banner ${className}`.trim()}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`sliding-banner__item ${fadeOut ? "sliding-banner__item--out" : ""}`}>
        {renderItem(item, index)}
      </div>

      {items.length > 1 && items.length <= 6 && (
        <div className="sliding-banner__dots" role="tablist" aria-label="Items">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`sliding-banner__dot ${i === index ? "sliding-banner__dot--active" : ""}`}
              onClick={() => {
                setIndex(i);
                setFadeOut(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
