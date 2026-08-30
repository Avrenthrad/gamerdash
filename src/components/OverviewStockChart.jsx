// Overview "Right now" stock-style chart — multi-series mastery /
// hours view: gold area for you, green lines per friend, red lines
// per guildmate. User picks the metric and range; data regrows on change.
// See DESIGN_TOKENS.md `stock-style` and lib/overviewChartData.js.

import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, LineSeries } from "lightweight-charts";
import { CHART_RANGES, loadOverviewChartData, rangeToDays } from "../lib/overviewChartData";

const GOLD = "#D4AF37";
const GOLD_FILL = "rgba(212, 175, 55, 0.34)";
const LIME = "#84cc16";
const ROSE = "#E8637D";
const GROW_MS = 1500;
const CHART_MIN_HEIGHT = 220;

const VIEWS = [
  {
    id: "mastery",
    title: "Mastery Score",
    subtitle: "You vs each friend & guildmate",
    empty: "No Mastery Score history in this range yet — check back after a few daily snapshots.",
    valueSuffix: "",
  },
  {
    id: "hours",
    title: "Active hours",
    subtitle: "Your Steam playtime vs friends (when timestamps are available)",
    empty: "No day-level Steam playtime in this range yet.",
    valueSuffix: "h",
  },
];

function getBlock(view, payload) {
  return view.id === "mastery" ? payload.mastery : payload.hours;
}

function peerPointCount(block) {
  if (!block?.peers) return 0;
  return block.peers.reduce((sum, peer) => sum + peer.points.length, 0);
}

function hasChartData(view, payload) {
  if (!payload) return false;
  const block = getBlock(view, payload);
  return block.you.length >= 2 || peerPointCount(block) >= 2 || block.you.length + peerPointCount(block) >= 2;
}

function latestValue(points) {
  if (!points.length) return null;
  return points[points.length - 1].value;
}

function peerColor(kind) {
  return kind === "guild" ? ROSE : LIME;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function priceFormatFor(isHours) {
  return isHours
    ? { type: "price", precision: 1, minMove: 0.1 }
    : { type: "price", precision: 0, minMove: 1 };
}

function valueRangeForBlock(block) {
  const values = [];
  for (const point of block.you || []) values.push(point.value);
  for (const peer of block.peers || []) {
    for (const point of peer.points) values.push(point.value);
  }
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.1, 1);
  return { minValue: min - pad, maxValue: max + pad };
}

function autoscaleProvider(range) {
  return () => ({
    priceRange: range,
  });
}

function interpolateGrowingPoints(points, progress) {
  if (!points.length) return [];
  const eased = easeInOutCubic(progress);

  if (points.length === 1) {
    return [{ time: points[0].time, value: points[0].value * eased }];
  }

  const firstTime = points[0].time;
  const lastTime = points[points.length - 1].time;
  const span = lastTime - firstTime;

  if (eased <= 0) {
    const base = points[0].value;
    return [
      { time: firstTime, value: base },
      { time: firstTime + Math.max(1, Math.floor(span / 120)), value: base },
    ];
  }

  const cursorTime = span === 0 ? lastTime : Math.floor(lerp(firstTime, lastTime, eased));
  const out = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.time < cursorTime) {
      out.push(point);
      continue;
    }

    const prev = points[Math.max(0, i - 1)];
    const next = point;
    const segmentSpan = next.time - prev.time;
    const segmentT = segmentSpan <= 0 ? 1 : (cursorTime - prev.time) / segmentSpan;
    const tipTime = Math.max(prev.time + 1, cursorTime);

    out.push({
      time: tipTime,
      value: lerp(prev.value, next.value, Math.max(0, Math.min(1, segmentT))),
    });
    break;
  }

  if (out.length < 2) {
    const anchor = out[0] ?? points[0];
    out.push({ time: anchor.time + Math.max(1, Math.floor(span / 120)), value: anchor.value });
  }

  return out;
}

function setStableScale(api, range) {
  if (!range) return;
  const provider = autoscaleProvider(range);
  api.seriesYou?.applyOptions({ autoscaleInfoProvider: provider });
  for (const series of api.peerSeries) {
    series.applyOptions({ autoscaleInfoProvider: provider });
  }
}

function clearStableScale(api) {
  api.seriesYou?.applyOptions({ autoscaleInfoProvider: undefined });
  for (const series of api.peerSeries) {
    series.applyOptions({ autoscaleInfoProvider: undefined });
  }
}

function cancelChartGrow(api) {
  if (api.animationId) {
    cancelAnimationFrame(api.animationId);
    api.animationId = null;
  }
  clearStableScale(api);
}

function ensureSeriesStructure(api, block, isHours) {
  const { chart } = api;
  const priceFormat = priceFormatFor(isHours);
  const peers = block.peers || [];

  if (api.seriesYou) {
    chart.removeSeries(api.seriesYou);
    api.seriesYou = null;
  }
  for (const series of api.peerSeries) chart.removeSeries(series);
  api.peerSeries = [];

  for (const peer of peers) {
    const series = chart.addSeries(LineSeries, {
      color: peerColor(peer.kind),
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceFormat,
      title: peer.label,
    });
    api.peerSeries.push(series);
  }

  api.seriesYou = chart.addSeries(AreaSeries, {
    lineWidth: 3,
    lineColor: GOLD,
    topColor: GOLD_FILL,
    bottomColor: "rgba(212, 175, 55, 0)",
    priceFormat,
    title: "You",
  });
}

function applyChartData(api, block) {
  for (let i = 0; i < (block.peers || []).length; i++) {
    api.peerSeries[i]?.setData(block.peers[i].points);
  }
  api.seriesYou?.setData(block.you);
  api.chart.timeScale().fitContent();
}

function animateChartGrow(api, block, { reducedMotion = false, onStart, onEnd } = {}) {
  cancelChartGrow(api);
  ensureSeriesStructure(api, block, block.isHours);

  if (reducedMotion || (!block.you.length && !peerPointCount(block))) {
    applyChartData(api, block);
    onEnd?.();
    return;
  }

  const stableRange = valueRangeForBlock(block);
  setStableScale(api, stableRange);

  onStart?.();
  const start = performance.now();
  let lastFrame = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / GROW_MS);

    if (now - lastFrame >= 16 || progress >= 1) {
      lastFrame = now;

      if (api.seriesYou) {
        api.seriesYou.setData(interpolateGrowingPoints(block.you, progress));
      }
      (block.peers || []).forEach((peer, i) => {
        api.peerSeries[i]?.setData(interpolateGrowingPoints(peer.points, progress));
      });
    }

    if (progress < 1) {
      api.animationId = requestAnimationFrame(tick);
      return;
    }

    clearStableScale(api);
    applyChartData(api, block);
    api.animationId = null;
    onEnd?.();
  }

  api.animationId = requestAnimationFrame(tick);
}

export default function OverviewStockChart({ userId, linkedSteamId }) {
  const [range, setRange] = useState("week");
  const [viewIndex, setViewIndex] = useState(0);
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("loading");
  const [growing, setGrowing] = useState(false);

  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const reducedMotionRef = useRef(false);

  const view = VIEWS[viewIndex];
  const sinceDays = rangeToDays(range);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = (e) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setStatus("loading");
    loadOverviewChartData({ userId, linkedSteamId, sinceDays })
      .then((data) => {
        setPayload(data);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Overview chart data failed:", err);
        setStatus("error");
      });
  }, [userId, linkedSteamId, sinceDays]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    function plotSize() {
      return {
        width: el.clientWidth,
        height: Math.max(el.clientHeight, CHART_MIN_HEIGHT),
      };
    }

    const { width, height } = plotSize();
    const chart = createChart(el, {
      width,
      height,
      layout: { background: { color: "transparent" }, textColor: "#8C8B90", attributionLogo: false },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.08)", style: 2 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        visible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        visible: true,
        scaleMargins: { top: 0.12, bottom: 0.06 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(212, 175, 55, 0.35)", width: 1, style: 2 },
        horzLine: { color: "rgba(212, 175, 55, 0.2)", width: 1, style: 2 },
      },
      handleScroll: false,
      handleScale: false,
    });

    apiRef.current = { chart, seriesYou: null, peerSeries: [], animationId: null };

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const next = plotSize();
      chart.applyOptions(next);
    });
    resizeObserver.observe(el);

    return () => {
      cancelChartGrow(apiRef.current);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!apiRef.current?.chart || !payload) return;
    const activeView = VIEWS[viewIndex];
    const block = getBlock(activeView, payload);
    if (!hasChartData(activeView, payload)) return;

    animateChartGrow(
      apiRef.current,
      { ...block, isHours: activeView.id === "hours" },
      {
        reducedMotion: reducedMotionRef.current,
        onStart: () => setGrowing(true),
        onEnd: () => setGrowing(false),
      },
    );
  }, [payload, viewIndex]);

  if (!userId) return null;

  const block = payload ? getBlock(view, payload) : null;
  const youValue = block ? latestValue(block.you) : null;
  const friendLineCount = block?.peers?.filter((p) => p.kind === "friend").length ?? 0;
  const guildLineCount = block?.peers?.filter((p) => p.kind === "guild").length ?? 0;
  const showChart = status === "ready" && payload && hasChartData(view, payload);
  const hoursNote = view.id === "hours" && payload?.hours?.note;

  return (
    <div className="stock-style-chart overview-stock-chart">
      <div className="overview-stock-chart__chrome">
        <div className="stock-style-chart__head">
          <div className="stock-style-chart__titles">
            <span className="stock-style-chart__title">{view.title}</span>
            <span className="stock-style-chart__subtitle">{view.subtitle}</span>
          </div>

          <div className="stock-style-chart__legend" aria-hidden="true">
            <span className="stock-style-chart__legend-item">
              <span className="stock-style-chart__legend-dot stock-style-chart__legend-dot--you" />
              You
              {youValue != null && (
                <span className="stock-style-chart__legend-value">
                  {Math.round(youValue).toLocaleString()}
                  {view.valueSuffix}
                </span>
              )}
            </span>
            {friendLineCount > 0 && (
              <span className="stock-style-chart__legend-item">
                <span className="stock-style-chart__legend-dot stock-style-chart__legend-dot--friends" />
                Friends ({friendLineCount})
              </span>
            )}
            {guildLineCount > 0 && (
              <span className="stock-style-chart__legend-item">
                <span className="stock-style-chart__legend-dot stock-style-chart__legend-dot--guild" />
                Guild ({guildLineCount})
              </span>
            )}
          </div>
        </div>

        {status === "loading" && <p className="panel__status overview-stock-chart__status">Loading chart…</p>}
        {status === "error" && <p className="panel__status panel__status--error overview-stock-chart__status">Couldn't load chart data.</p>}
        {status === "ready" && !showChart && (
          <p className="panel__status overview-stock-chart__status">
            {hoursNote || view.empty}
          </p>
        )}
      </div>

      <div
        className={`overview-stock-chart__plot-stage ${showChart ? "overview-stock-chart__plot-stage--live" : "overview-stock-chart__plot-stage--idle"}${growing ? " overview-stock-chart__plot-stage--growing" : ""}`}
      >
        <div
          ref={containerRef}
          className={`stock-style-chart__plot overview-stock-chart__plot ${showChart ? "" : "overview-stock-chart__plot--hidden"}`}
          aria-hidden={!showChart}
        />
      </div>

      <div className="overview-stock-chart__footer">
        <div className="overview-stock-chart__ranges" role="tablist" aria-label="Chart time range">
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={`overview-stock-chart__range ${range === r.id ? "overview-stock-chart__range--active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="sliding-banner__dots" role="tablist" aria-label="Chart metric">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === viewIndex}
              aria-label={v.title}
              className={`sliding-banner__dot ${i === viewIndex ? "sliding-banner__dot--active" : ""}`}
              onClick={() => setViewIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
