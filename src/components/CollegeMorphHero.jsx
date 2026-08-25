// Hero moment: "Constellation Marks" — drifting particles that loosely
// trace one College's silhouette at a time, connected by faint lines,
// cross-fading into the next College's formation on a loop. Extends
// the same visual language as CollectionConstellationBackground.jsx
// (particles + connecting lines) into the hero itself, rather than
// being a fourth unrelated icon system — see the shape data in
// lib/constellationShapes.js for why each shape is exactly 12 points.
//
// Canvas, not SVG — this is genuinely generative/animated per-frame
// motion (continuous jitter plus a cross-fade morph), which is what
// canvas is for; hand-authoring that as SVG keyframes would mean a
// separate animation definition per shape pair.

import { useEffect, useRef, useState } from "react";
import { BADGE_COLOR } from "./CollegeIcon";
import { CONSTELLATION_SHAPES, CONSTELLATION_ORDER } from "../lib/constellationShapes";

const HOLD_MS = 2200;
const MORPH_MS = 1400;
const CANVAS_SIZE = 220;

const LABELS = {
  gaming: "Gaming",
  tcg: "TCG",
  entertainment: "Entertainment",
  collectibles: "Collectibles",
  tabletop: "Tabletop",
};

// Cubic ease so the morph settles rather than arriving linearly.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function CollegeMorphHero() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("hold"); // "hold" | "morphing"
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const rafRef = useRef(null);

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

  // Advances the hold/morph state machine — same shape as the old
  // icon-morph version, just driving a canvas instead of CSS keyframes.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    const timer = setTimeout(
      () => {
        if (phase === "hold") {
          setPhase("morphing");
        } else {
          setIndex((i) => (i + 1) % CONSTELLATION_ORDER.length);
          setPhase("hold");
        }
      },
      phase === "hold" ? HOLD_MS : MORPH_MS
    );
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, visible]);

  const currentCollege = CONSTELLATION_ORDER[index];
  const nextCollege = CONSTELLATION_ORDER[(index + 1) % CONSTELLATION_ORDER.length];
  const morphing = phase === "morphing" && !reducedMotion;

  // The actual particle render loop — reads current/morphing/reducedMotion
  // via refs updated below so the rAF loop itself never needs to restart.
  const stateRef = useRef({});
  stateRef.current = { currentCollege, nextCollege, morphing, reducedMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    let start = performance.now();
    let running = true;

    function draw(now) {
      if (!running) return;
      const { currentCollege, nextCollege, morphing, reducedMotion } = stateRef.current;
      const t = now - start;
      const currentPts = CONSTELLATION_SHAPES[currentCollege];
      const nextPts = CONSTELLATION_SHAPES[nextCollege];
      const morphT = morphing ? easeInOutCubic(Math.min(phaseElapsed(t) / MORPH_MS, 1)) : 0;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const jitterOn = !reducedMotion;
      const points = currentPts.map(([x, y], i) => {
        const [nx, ny] = nextPts[i];
        const bx = x + (nx - x) * morphT;
        const by = y + (ny - y) * morphT;
        const jitter = jitterOn ? Math.sin(now / 900 + i * 1.7) * 3 : 0;
        const jitterY = jitterOn ? Math.cos(now / 1100 + i * 1.3) * 3 : 0;
        return [bx + jitter, by + jitterY];
      });

      const colorFrom = getCssColor(BADGE_COLOR[currentCollege]);
      const colorTo = getCssColor(BADGE_COLOR[nextCollege]);
      const color = mixColor(colorFrom, colorTo, morphT);

      drawGlow(ctx, color);
      fillSilhouette(ctx, points, color);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fill();
      });

      if (!reducedMotion) rafRef.current = requestAnimationFrame(draw);
    }

    // Tracks how far into the CURRENT morph phase we are, independent
    // of the overall rAF clock — reset whenever `morphing` flips.
    let morphPhaseStart = null;
    let lastMorphing = false;
    function phaseElapsed(now) {
      if (stateRef.current.morphing && !lastMorphing) morphPhaseStart = now;
      lastMorphing = stateRef.current.morphing;
      return morphPhaseStart === null ? 0 : now - morphPhaseStart;
    }

    if (reducedMotion) {
      draw(performance.now());
    } else if (visible) {
      // Only starts the continuous jitter loop while actually on
      // screen — this effect re-runs on every `visible` flip (see the
      // dependency array below), so scrolling the hero off-screen
      // tears the rAF loop down instead of burning frames unseen.
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, visible]);

  // Redraw once immediately on a state change while reduced-motion is
  // on (no rAF loop running to pick it up otherwise).
  useEffect(() => {
    if (!reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pts = CONSTELLATION_SHAPES[currentCollege];
    const color = getCssColor(BADGE_COLOR[currentCollege]);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawGlow(ctx, color);
    fillSilhouette(ctx, pts, color);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55;
    pts.forEach((p, i) => {
      const next = pts[(i + 1) % pts.length];
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(next[0], next[1]);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    pts.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }, [currentCollege, reducedMotion]);

  return (
    <div ref={containerRef} className="college-morph-hero">
      <canvas ref={canvasRef} className="college-morph-hero__canvas" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }} />
      <span className="college-morph-hero__label">{LABELS[morphing ? nextCollege : currentCollege]}</span>
    </div>
  );
}

// Ambient glow drawn straight into the canvas rather than a separate
// CSS box-shadow-blurred div — the previous div-based glow rendered as
// a hard-edged solid black circle instead of a soft colored blur on at
// least one real device/WebView combination (confirmed via screenshot,
// never reproduced or explained despite the CSS looking correct), so
// moving it here trades an unreliable cross-engine CSS blur for a
// canvas primitive that already proved consistent under manual testing.
function drawGlow(ctx, color) {
  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, CANVAS_SIZE / 2);
  gradient.addColorStop(0, withAlpha(color, 0.35));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

// The particles-and-faint-lines look alone never reads as a shape at a
// glance — three rounds of adjusting point coordinates confirmed the
// problem isn't the geometry, it's that nothing ever fills it. This
// draws the actual silhouette as a soft translucent fill so the
// outline registers as a solid recognizable mark, with the sparkle
// dots/lines layered on top for the constellation texture.
function fillSilhouette(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.globalAlpha = 1;
  ctx.fillStyle = withAlpha(color, 0.22);
  ctx.fill();
}

function withAlpha(rgbOrHex, alpha) {
  const rgb = rgbOrHex.startsWith("rgb") ? rgbOrHex.match(/\d+/g).map(Number) : hexToRgb(rgbOrHex);
  if (!rgb) return rgbOrHex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

// BADGE_COLOR entries are CSS custom-property references (e.g.
// "var(--sky)") — resolve to a real color string so canvas (which
// doesn't understand var()) can use it directly, and so colors can be
// numerically mixed during a morph.
function getCssColor(cssVarExpr) {
  const match = /var\((--[a-z-]+)\)/.exec(cssVarExpr);
  if (!match) return cssVarExpr;
  const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return value || "#D4AF37";
}

function mixColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return t < 0.5 ? a : b;
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
