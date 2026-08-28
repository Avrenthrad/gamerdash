// Hero moment: the real, hand-built College icon (CollegeIcon.jsx —
// the same glyph already used in the nav tabs and the sign-in
// background) crossfading between the 5 Colleges, over a soft ambient
// drifting-particle field for atmosphere.
//
// Previous version ("Constellation Marks") tried to APPROXIMATE each
// icon's silhouette from ~12 particle points connected by lines. Three
// rounds of reshaping those points never read as a recognizable shape
// — a dozen rough points simply can't draw a real icon (a controller,
// a trophy, a d20). Using the actual vector artwork solves legibility
// directly instead of chasing it through point placement. The ambient
// particles stay, reusing the exact technique from
// CollectionConstellationBackground.jsx, but now purely as atmosphere
// behind the icon rather than trying to trace it.

import { useEffect, useRef, useState } from "react";
import CollegeIcon from "./CollegeIcon";
import { BADGE_COLOR } from "../lib/collegeColors";

const HOLD_MS = 2400;
const FADE_MS = 420;
const CANVAS_SIZE = 220;
const PARTICLE_COUNT = 26;
const LINK_DISTANCE = 70;

const COLLEGE_ORDER = ["gaming", "tcg", "entertainment", "collectibles", "tabletop"];
const LABELS = {
  gaming: "Gaming",
  tcg: "TCG",
  entertainment: "Library",
  collectibles: "Loot",
  tabletop: "Wartable",
};

export default function CollegeMorphHero() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const colorRef = useRef("56, 189, 248"); // sky fallback, matches BADGE_COLOR.gaming

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

  const currentCollege = COLLEGE_ORDER[index];

  // Hold -> fade out -> advance to next College -> fade in, looping.
  // Skipped entirely under reduced motion or while off-screen.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    if (!fadeOut) {
      const t = setTimeout(() => setFadeOut(true), HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % COLLEGE_ORDER.length);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadeOut, reducedMotion, visible]);

  // Keeps the ambient particle color following whichever College is
  // current, read from the same CSS custom properties CollegeIcon uses.
  useEffect(() => {
    const match = /var\((--[a-z-]+)\)/.exec(BADGE_COLOR[currentCollege]);
    const value = match ? getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() : null;
    const rgb = value && hexToRgb(value);
    if (rgb) colorRef.current = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }, [currentCollege]);

  // Ambient particle field — free-drifting dots with faint links, the
  // exact technique from CollectionConstellationBackground.jsx, just
  // scoped to this canvas and with no shape it's trying to trace.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * CANVAS_SIZE,
      y: Math.random() * CANVAS_SIZE,
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.16,
    }));

    let rafId = null;
    let running = true;

    function step() {
      if (!running) return;
      const rgb = colorRef.current;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      if (!reducedMotion) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > CANVAS_SIZE) p.vx *= -1;
          if (p.y < 0 || p.y > CANVAS_SIZE) p.vy *= -1;
          p.x = Math.max(0, Math.min(CANVAS_SIZE, p.x));
          p.y = Math.max(0, Math.min(CANVAS_SIZE, p.y));
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${rgb}, ${0.14 * (1 - dist / LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = `rgba(${rgb}, 0.5)`;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) rafId = requestAnimationFrame(step);
    }

    if (reducedMotion) {
      step();
    } else if (visible) {
      rafId = requestAnimationFrame(step);
    }

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, visible]);

  return (
    <div ref={containerRef} className="college-morph-hero">
      <canvas
        ref={canvasRef}
        className="college-morph-hero__canvas"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      />
      <div className={`college-morph-hero__mark ${fadeOut ? "college-morph-hero__mark--out" : ""}`}>
        <CollegeIcon collegeId={currentCollege} size={96} className="college-morph-hero__icon" />
        <span className="college-morph-hero__label">{LABELS[currentCollege]}</span>
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
