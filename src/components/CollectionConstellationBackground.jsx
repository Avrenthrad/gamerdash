// Ambient background for the sign-in screen — a slow-drifting particle
// field with the 5 real Colleges anchored as nodes, nearby particles
// linked by faint lines. Framed as "your collection's constellation",
// not a market/data-stream visual — no invented numbers, prices, or
// tickers anywhere in it, just motion and the 5 real College icons.
//
// Canvas 2D on purpose (not WebGL/Three.js) — this is ~70 dots and a
// distance check between them, nowhere near needing a 3D engine, and
// Canvas 2D is cheap enough to run behind a static login form without
// competing for the main thread with anything real.

import { useEffect, useRef, useState } from "react";
import CollegeIcon from "./CollegeIcon";

const COLLEGES = [
  { id: "gaming", label: "Gaming" },
  { id: "tcg", label: "TCG" },
  { id: "entertainment", label: "Entertainment" },
  { id: "collectibles", label: "Collectibles" },
  { id: "tabletop", label: "Tabletop" },
];

// Pentagon layout in fractional (0-1) canvas coordinates — recomputed
// against the live canvas size on every resize, never hardcoded pixels.
const NODE_POSITIONS = COLLEGES.map((_, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / COLLEGES.length;
  return { x: 0.5 + 0.36 * Math.cos(angle), y: 0.5 + 0.36 * Math.sin(angle) * 1.15 };
});

const LINK_DISTANCE = 130;
const NODE_LINK_DISTANCE = 220;
const POINTER_RADIUS = 90;

function particleCountFor(width, height) {
  const base = Math.round((width * height) / 14000);
  return Math.max(24, Math.min(70, base));
}

export default function CollectionConstellationBackground() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const accentColorRef = useRef("212, 175, 55"); // r,g,b fallback matching the default gold
  const [nodePositions, setNodePositions] = useState(NODE_POSITIONS);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = null;
    let running = false;
    let pointer = { x: -9999, y: -9999 };

    function readAccentColor() {
      const hex = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
      if (m) {
        accentColorRef.current = `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
      }
    }

    function seedParticles() {
      const count = particleCountFor(width, height);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
      }));
    }

    function resize() {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      setNodePositions(NODE_POSITIONS.map((p) => ({ x: p.x * width, y: p.y * height })));
      seedParticles();
    }

    function step() {
      const rgb = accentColorRef.current;
      ctx.clearRect(0, 0, width, height);

      const nodes = NODE_POSITIONS.map((p) => ({ x: p.x * width, y: p.y * height }));

      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx;
          p.y += p.vy;

          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 0.001) {
            const force = (1 - dist / POINTER_RADIUS) * 0.012;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }

          const speed = Math.hypot(p.vx, p.vy);
          const maxSpeed = 0.35;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.x = Math.max(0, Math.min(width, p.x));
          p.y = Math.max(0, Math.min(height, p.y));
        }
      }

      // particle-to-particle links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${rgb}, ${0.12 * (1 - dist / LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // particle-to-College-node links
      for (const particle of particles) {
        for (const node of nodes) {
          const dist = Math.hypot(particle.x - node.x, particle.y - node.y);
          if (dist < NODE_LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${rgb}, ${0.16 * (1 - dist / NODE_LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(node.x, node.y);
            ctx.stroke();
          }
        }
      }

      // particles themselves
      ctx.fillStyle = `rgba(${rgb}, 0.55)`;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion && running) {
        rafId = requestAnimationFrame(step);
      }
    }

    function start() {
      if (running) return;
      running = true;
      if (reduceMotion) {
        step(); // one static frame, no loop
      } else {
        rafId = requestAnimationFrame(step);
      }
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    function handlePointerMove(e) {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function handlePointerLeave() {
      pointer = { x: -9999, y: -9999 };
    }
    function handleVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.01 }
    );
    intersectionObserver.observe(wrap);

    const accentObserver = new MutationObserver(readAccentColor);
    accentObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-accent"] });

    readAccentColor();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      accentObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="constellation-bg" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} className="constellation-bg__canvas" />
      <div className="constellation-bg__scrim" />
      {nodePositions.map((pos, i) => (
        <div
          key={COLLEGES[i].id}
          className="constellation-bg__node"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        >
          <CollegeIcon collegeId={COLLEGES[i].id} size={26} />
          <span className="constellation-bg__node-label">{COLLEGES[i].label}</span>
        </div>
      ))}
    </div>
  );
}
