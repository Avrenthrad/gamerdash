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
const ICON_SIZE = 112;

const COLLEGE_ORDER = ["gaming", "tcg", "entertainment", "collectibles", "tabletop"];
const LABELS = {
  gaming: "Gaming",
  tcg: "TCG",
  entertainment: "Library",
  collectibles: "Loot",
  tabletop: "Wartable",
};

export default function CollegeMorphHero({ focusCollegeId = null, className = "" }) {
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

  // External driver (e.g. Overview stat carousel) — crossfade to the
  // requested College and pause the autonomous loop until released.
  useEffect(() => {
    if (!focusCollegeId) return;
    const targetIndex = COLLEGE_ORDER.indexOf(focusCollegeId);
    if (targetIndex < 0 || targetIndex === index) return;
    setFadeOut(true);
    const t = setTimeout(() => {
      setIndex(targetIndex);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [focusCollegeId, index]);

  // Hold -> fade out -> advance to next College -> fade in, looping.
  // Skipped entirely under reduced motion or while off-screen.
  useEffect(() => {
    if (focusCollegeId || reducedMotion || !visible) return;
    if (!fadeOut) {
      const t = setTimeout(() => setFadeOut(true), HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % COLLEGE_ORDER.length);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadeOut, reducedMotion, visible, focusCollegeId]);

  // Keeps the ambient particle color following whichever College is
  // current, read from the same CSS custom properties CollegeIcon uses.
  useEffect(() => {
    const match = /var\((--[a-z-]+)\)/.exec(BADGE_COLOR[currentCollege]);
    const value = match ? getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() : null;
    const rgb = value && hexToRgb(value);
    if (rgb) colorRef.current = `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }, [currentCollege]);

  // Ambient particle field — fills the hero container edge-to-edge.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let linkDistance = 90;
    let particles = [];
    let rafId = null;
    let running = true;

    function seedParticles(w, h) {
      const count = Math.max(36, Math.min(110, Math.round((w * h) / 3800)));
      linkDistance = Math.max(80, Math.min(168, Math.min(w, h) * 0.3));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
      }));
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles(width, height);
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    function step() {
      if (!running) return;
      const rgb = colorRef.current;
      ctx.clearRect(0, 0, width, height);

      if (!reducedMotion) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.x = Math.max(0, Math.min(width, p.x));
          p.y = Math.max(0, Math.min(height, p.y));
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < linkDistance) {
            ctx.strokeStyle = `rgba(${rgb}, ${0.24 * (1 - dist / linkDistance)})`;
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = `rgba(${rgb}, 0.62)`;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.75, 0, Math.PI * 2);
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
      resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, visible]);

  return (
    <div ref={containerRef} className={`college-morph-hero${className ? ` ${className}` : ""}`}>
      <canvas ref={canvasRef} className="college-morph-hero__canvas" aria-hidden="true" />
      <div className={`college-morph-hero__mark ${fadeOut ? "college-morph-hero__mark--out" : ""}`}>
        <CollegeIcon collegeId={currentCollege} size={ICON_SIZE} className="college-morph-hero__icon" />
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
