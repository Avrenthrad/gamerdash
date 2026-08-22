// Hero moment: the 5 real College glyphs (see CollegeIcon.jsx — the
// same controller/cards/clapperboard/trophy/d20 marks used in the nav)
// liquid-morphing into one another in a loop. No new art — this reuses
// the exact icons already in the app.
//
// True SVG path morphing between these glyphs isn't viable (they're
// built from mismatched primitives — rects, circles, and paths with
// different point counts), so this uses the standard "gooey" SVG
// filter technique instead: two icons cross-fade/scale inside a
// heavily-blurred-then-recontrasted filter, which makes the blur blend
// into a liquid blob rather than a plain crossfade. Purely CSS/SVG —
// no generated imagery, no video file.

import { useEffect, useId, useRef, useState } from "react";
import CollegeIcon, { BADGE_COLOR } from "./CollegeIcon";

const COLLEGE_ORDER = ["gaming", "tcg", "entertainment", "collectibles", "tabletop"];
const HOLD_MS = 800;
const MORPH_MS = 1200;

export default function CollegeMorphHero() {
  const filterId = useId();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("hold"); // "hold" | "morphing"
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef(null);

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
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || !visible) return;

    const timer = setTimeout(
      () => {
        if (phase === "hold") {
          setPhase("morphing");
        } else {
          setIndex((i) => (i + 1) % COLLEGE_ORDER.length);
          setPhase("hold");
        }
      },
      phase === "hold" ? HOLD_MS : MORPH_MS
    );
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, visible]);

  const currentCollege = COLLEGE_ORDER[index];
  const nextCollege = COLLEGE_ORDER[(index + 1) % COLLEGE_ORDER.length];
  const morphing = phase === "morphing" && !reducedMotion;
  const ambientColor = BADGE_COLOR[morphing ? nextCollege : currentCollege];

  return (
    <div ref={containerRef} className="college-morph-hero">
      <div className="college-morph-hero__glow" style={{ "--glow-color": ambientColor }} />
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="college-morph-hero__stage" style={{ filter: `url(#${filterId})` }}>
        <div
          className={`college-morph-hero__icon college-morph-hero__icon--current ${
            morphing ? "college-morph-hero__icon--outgoing" : ""
          }`}
        >
          <CollegeIcon collegeId={currentCollege} size={180} />
        </div>
        {morphing && (
          <div className="college-morph-hero__icon college-morph-hero__icon--incoming">
            <CollegeIcon collegeId={nextCollege} size={180} />
          </div>
        )}
      </div>
    </div>
  );
}
