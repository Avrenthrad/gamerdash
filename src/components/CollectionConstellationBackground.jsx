// Ambient background for the sign-in screen — a drifting, triangulated
// particle mesh with the 5 real Colleges anchored as nodes. Framed as
// "your collection's constellation", not a market/data-stream visual —
// no invented numbers, prices, or tickers anywhere in it, just motion
// and the 5 real College icons.
//
// Canvas 2D on purpose (not WebGL/Three.js). Density is what makes this
// read as a star map rather than empty space, so the cost controls are
// structural rather than "keep the count tiny": particles are bucketed
// into a uniform spatial hash so link-finding is local instead of
// O(n²), each particle keeps at most MAX_EDGES_PER_PARTICLE links, and
// every line is accumulated into one of a few alpha buckets so a frame
// costs a handful of stroke() calls instead of one per segment.

import { useEffect, useRef, useState } from "react";
import CollegeIcon from "./CollegeIcon";

const COLLEGES = [
  { id: "gaming", label: "Gaming", cssVar: "--sky" },
  { id: "tcg", label: "TCG", cssVar: "--violet" },
  { id: "entertainment", label: "Library", cssVar: "--rose" },
  { id: "collectibles", label: "Loot", cssVar: "--amber" },
  { id: "tabletop", label: "Wartable", cssVar: "--lime" },
];

// Fractional (0-1) canvas coordinates, recomputed against the live
// canvas size on every resize, never hardcoded pixels. Deliberately
// NOT a centred pentagon: the caption plate owns the bottom of the
// hero, so a centred ring buried two of the five Colleges behind it
// while the headline said "Five Colleges." These sit in the upper ~55%
// — still a ring, just squashed and lifted into the clear area.
const NODE_POSITIONS = [
  { x: 0.5, y: 0.12 }, // gaming
  { x: 0.82, y: 0.28 }, // tcg
  { x: 0.7, y: 0.52 }, // entertainment
  { x: 0.3, y: 0.53 }, // collectibles
  { x: 0.18, y: 0.27 }, // tabletop
];

const LINK_DISTANCE = 118;
const MAX_EDGES_PER_PARTICLE = 3;
const NODE_LINK_DISTANCE = 190;
const MAX_EDGES_PER_NODE = 6;
const POINTER_RADIUS = 90;
const ALPHA_BUCKETS = 4;

function particleCountFor(width, height) {
  const base = Math.round((width * height) / 8200);
  return Math.max(40, Math.min(150, base));
}

// Deterministic PRNG so the field is the same composition every load —
// which matters most under prefers-reduced-motion, where the single
// frame drawn has to be a considered layout rather than a lucky roll.
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function CollectionConstellationBackground() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const accentColorRef = useRef("212, 175, 55"); // r,g,b fallback matching the default gold
  const nodeColorsRef = useRef(COLLEGES.map(() => "212, 175, 55"));
  const [nodePositions, setNodePositions] = useState(NODE_POSITIONS);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery?.matches ?? false;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = null;
    let running = false;
    let pointer = { x: -9999, y: -9999 };

    // Spatial hash, rebuilt each frame. cells[] holds particle indices
    // per bucket; bucket size is the link radius so a particle only has
    // to look at its own cell and the 8 around it.
    let cols = 0;
    let rows = 0;
    let cells = [];
    // Reused per-frame line buffers, one flat [x1,y1,x2,y2,...] array
    // per alpha bucket, so nothing allocates inside the loop.
    const lineBuckets = Array.from({ length: ALPHA_BUCKETS }, () => []);
    const nodeLineBuckets = COLLEGES.map(() => []);

    function parseRgb(value, fallback) {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(value.trim());
      if (!m) return fallback;
      return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
    }

    function readColors() {
      const styles = getComputedStyle(document.documentElement);
      accentColorRef.current = parseRgb(styles.getPropertyValue("--accent"), accentColorRef.current);
      nodeColorsRef.current = COLLEGES.map((college, i) =>
        parseRgb(styles.getPropertyValue(college.cssVar), nodeColorsRef.current[i])
      );
    }

    // Jittered grid rather than pure random: uniform coverage with no
    // bald patches, which is the difference between "dense mesh" and
    // "a few clumps and a lot of black". depth 0 = far (small, dim,
    // slow), depth 1 = near (larger, brighter, faster) — that speed
    // difference is the parallax.
    function seedParticles() {
      const count = particleCountFor(width, height);
      const rand = mulberry32(0x5eed1a);
      const gridCols = Math.max(1, Math.round(Math.sqrt((count * width) / Math.max(height, 1))));
      const gridRows = Math.max(1, Math.ceil(count / gridCols));
      const cellW = width / gridCols;
      const cellH = height / gridRows;

      particles = [];
      for (let i = 0; i < count; i++) {
        const gx = i % gridCols;
        const gy = Math.floor(i / gridCols) % gridRows;
        const depth = rand();
        const speed = 0.3 + depth * 1.2;
        particles.push({
          x: (gx + 0.15 + rand() * 0.7) * cellW,
          y: (gy + 0.15 + rand() * 0.7) * cellH,
          vx: (rand() - 0.5) * 0.16 * speed,
          vy: (rand() - 0.5) * 0.16 * speed,
          depth,
          radius: 0.75 + depth * 1.75,
          alpha: 0.16 + depth * 0.5,
          maxSpeed: 0.12 + depth * 0.32,
        });
      }

      cols = Math.max(1, Math.ceil(width / LINK_DISTANCE));
      rows = Math.max(1, Math.ceil(height / LINK_DISTANCE));
      cells = Array.from({ length: cols * rows }, () => []);
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
      if (reduceMotion) step();
    }

    function advance() {
      for (const p of particles) {
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
        if (speed > p.maxSpeed) {
          p.vx = (p.vx / speed) * p.maxSpeed;
          p.vy = (p.vy / speed) * p.maxSpeed;
        }

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));
      }
    }

    function rebuildGrid() {
      for (const cell of cells) cell.length = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x / LINK_DISTANCE)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.y / LINK_DISTANCE)));
        cells[cy * cols + cx].push(i);
      }
    }

    function collectParticleLinks() {
      for (const bucket of lineBuckets) bucket.length = 0;

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(a.x / LINK_DISTANCE)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(a.y / LINK_DISTANCE)));
        let edges = 0;

        for (let oy = -1; oy <= 1 && edges < MAX_EDGES_PER_PARTICLE; oy++) {
          const ny = cy + oy;
          if (ny < 0 || ny >= rows) continue;
          for (let ox = -1; ox <= 1 && edges < MAX_EDGES_PER_PARTICLE; ox++) {
            const nx = cx + ox;
            if (nx < 0 || nx >= cols) continue;
            const cell = cells[ny * cols + nx];
            for (const j of cell) {
              // j > i only — each pair is considered once, which also
              // stops a dense cell from spending a whole particle's
              // edge budget on links already drawn.
              if (j <= i) continue;
              const b = particles[j];
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              if (dist >= LINK_DISTANCE) continue;
              const falloff = 1 - dist / LINK_DISTANCE;
              const strength = falloff * (0.35 + ((a.depth + b.depth) / 2) * 0.65);
              const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(strength * ALPHA_BUCKETS));
              lineBuckets[bucket].push(a.x, a.y, b.x, b.y);
              if (++edges >= MAX_EDGES_PER_PARTICLE) break;
            }
          }
        }
      }
    }

    function collectNodeLinks(nodes) {
      for (const bucket of nodeLineBuckets) bucket.length = 0;

      for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        const bucket = nodeLineBuckets[n];
        const cx = Math.floor(node.x / LINK_DISTANCE);
        const cy = Math.floor(node.y / LINK_DISTANCE);
        // Node radius is wider than the particle link radius, so this
        // sweeps two cells out rather than one.
        const reach = Math.ceil(NODE_LINK_DISTANCE / LINK_DISTANCE);
        let edges = 0;

        for (let oy = -reach; oy <= reach && edges < MAX_EDGES_PER_NODE; oy++) {
          const ny = cy + oy;
          if (ny < 0 || ny >= rows) continue;
          for (let ox = -reach; ox <= reach && edges < MAX_EDGES_PER_NODE; ox++) {
            const nx = cx + ox;
            if (nx < 0 || nx >= cols) continue;
            for (const i of cells[ny * cols + nx]) {
              const p = particles[i];
              const dist = Math.hypot(p.x - node.x, p.y - node.y);
              if (dist >= NODE_LINK_DISTANCE) continue;
              bucket.push(p.x, p.y, node.x, node.y, 1 - dist / NODE_LINK_DISTANCE);
              if (++edges >= MAX_EDGES_PER_NODE) break;
            }
          }
        }
      }
    }

    function step() {
      const rgb = accentColorRef.current;
      ctx.clearRect(0, 0, width, height);

      const nodes = NODE_POSITIONS.map((p) => ({ x: p.x * width, y: p.y * height }));

      if (!reduceMotion) advance();
      rebuildGrid();
      collectParticleLinks();
      collectNodeLinks(nodes);

      // One path (and one stroke) per alpha bucket — the mesh is
      // hundreds of segments and per-segment stroke() calls are what
      // would actually make this expensive.
      ctx.lineWidth = 1;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const coords = lineBuckets[b];
        if (!coords.length) continue;
        ctx.strokeStyle = `rgba(${rgb}, ${(0.05 + (b / (ALPHA_BUCKETS - 1)) * 0.16).toFixed(3)})`;
        ctx.beginPath();
        for (let k = 0; k < coords.length; k += 4) {
          ctx.moveTo(coords[k], coords[k + 1]);
          ctx.lineTo(coords[k + 2], coords[k + 3]);
        }
        ctx.stroke();
      }

      // Node spokes carry the College's own categorical accent, so the
      // five anchors read as distinct without inventing a hue.
      for (let n = 0; n < nodeLineBuckets.length; n++) {
        const coords = nodeLineBuckets[n];
        if (!coords.length) continue;
        const nodeRgb = nodeColorsRef.current[n];
        for (let k = 0; k < coords.length; k += 5) {
          ctx.strokeStyle = `rgba(${nodeRgb}, ${(0.26 * coords[k + 4]).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(coords[k], coords[k + 1]);
          ctx.lineTo(coords[k + 2], coords[k + 3]);
          ctx.stroke();
        }
      }

      // Particles, far layer first so near ones sit on top. Depth is
      // carried by size and brightness rather than a real blur —
      // canvas filter blur over a full-size animated canvas is exactly
      // the thing that stutters in a mobile WebView.
      for (const p of particles) {
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        if (p.depth > 0.78) {
          ctx.fillStyle = `rgba(${rgb}, ${(p.alpha * 0.18).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
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

    // Flipping the OS setting mid-session either freezes the current
    // frame in place or resumes the loop, rather than leaving a
    // half-animated field behind.
    function handleMotionChange(e) {
      reduceMotion = e.matches;
      if (!running) return;
      if (reduceMotion) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        step();
      } else if (!rafId) {
        rafId = requestAnimationFrame(step);
      }
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

    const accentObserver = new MutationObserver(readColors);
    accentObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode", "data-accent"] });

    readColors();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery?.addEventListener("change", handleMotionChange);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      accentObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionQuery?.removeEventListener("change", handleMotionChange);
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
