// Auto-rotating banner — one item visible at a time, sliding horizontally
// to the next on a timer. Shared by SteamPresenceCard and GuildPulseCard
// so neither re-implements its own rotation logic.
//
// Deliberately dumb about content — holds an index and calls
// renderItem(item, index); callers own what a slide looks like.

import { useEffect, useRef, useState } from "react";

const HOLD_MS = 3600;
const SLIDE_MS = 420;

export default function SlidingBanner({
  items,
  renderItem,
  getItemKey,
  emptyState = null,
  className = "",
  dotsLabel = "Items",
}) {
  const [index, setIndex] = useState(0);
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

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  useEffect(() => {
    if (reducedMotion || !visible || paused || items.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, HOLD_MS);
    return () => clearInterval(timer);
  }, [reducedMotion, visible, paused, items.length]);

  if (items.length === 0) return emptyState;

  return (
    <div
      ref={containerRef}
      className={`sliding-banner ${className}`.trim()}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="sliding-banner__viewport">
        <div
          className="sliding-banner__track"
          style={{
            transform: `translate3d(-${index * 100}%, 0, 0)`,
            transition: reducedMotion ? "none" : `transform ${SLIDE_MS}ms var(--ease-standard)`,
          }}
        >
          {items.map((item, i) => (
            <div
              key={getItemKey ? getItemKey(item, i) : i}
              className="sliding-banner__slide"
              aria-hidden={i !== index}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && items.length <= 8 && (
        <div className="sliding-banner__dots" role="tablist" aria-label={dotsLabel}>
          {items.map((item, i) => (
            <button
              key={getItemKey ? getItemKey(item, i) : i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`sliding-banner__dot ${i === index ? "sliding-banner__dot--active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
