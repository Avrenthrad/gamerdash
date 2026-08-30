// Overview "Right now" stock-style chart — multi-series mastery /
// hours view: gold area for you, green lines per friend, red lines
// per guildmate. Rotates between Mastery Score and Steam active hours.
// See DESIGN_TOKENS.md `stock-style` and lib/overviewChartData.js.

import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, LineSeries } from "lightweight-charts";
import { CHART_RANGES, loadOverviewChartData, rangeToDays } from "../lib/overviewChartData";

const GOLD = "#D4AF37";
const GOLD_FILL = "rgba(212, 175, 55, 0.34)";
const LIME = "#84cc16";
const ROSE = "#E8637D";
const VIEW_HOLD_MS = 5200;
const FADE_MS = 380;
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

function syncChartSeries(api, block, isHours = false) {
  const { chart } = api;
  const priceFormat = isHours
    ? { type: "price", precision: 1, minMove: 0.1 }
    : { type: "price", precision: 0, minMove: 1 };

  if (api.seriesYou) {
    chart.removeSeries(api.seriesYou);
    api.seriesYou = null;
  }
  for (const series of api.peerSeries) chart.removeSeries(series);
  api.peerSeries = [];

  for (const peer of block.peers || []) {
    const series = chart.addSeries(LineSeries, {
      color: peerColor(peer.kind),
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceFormat,
      title: peer.label,
    });
    series.setData(peer.points);
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
  api.seriesYou.setData(block.you);
  chart.timeScale().fitContent();
}

export default function OverviewStockChart({ userId, linkedSteamId }) {
  const [range, setRange] = useState("week");
  const [viewIndex, setViewIndex] = useState(0);
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("loading");
  const [fadeOut, setFadeOut] = useState(false);
  const [paused, setPaused] = useState(false);

  const containerRef = useRef(null);
  const apiRef = useRef(null);

  const view = VIEWS[viewIndex];
  const sinceDays = rangeToDays(range);

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

    apiRef.current = { chart, seriesYou: null, peerSeries: [] };

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const next = plotSize();
      chart.applyOptions(next);
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!apiRef.current?.chart || !payload) return;
    const activeView = VIEWS[viewIndex];
    const block = getBlock(activeView, payload);
    syncChartSeries(apiRef.current, block, activeView.id === "hours");
  }, [payload, viewIndex]);

  useEffect(() => {
    if (paused || VIEWS.length < 2) return;
    if (!fadeOut) {
      const t = setTimeout(() => setFadeOut(true), VIEW_HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setViewIndex((i) => (i + 1) % VIEWS.length);
      setFadeOut(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadeOut, paused]);

  if (!userId) return null;

  const block = payload ? getBlock(view, payload) : null;
  const youValue = block ? latestValue(block.you) : null;
  const friendLineCount = block?.peers?.filter((p) => p.kind === "friend").length ?? 0;
  const guildLineCount = block?.peers?.filter((p) => p.kind === "guild").length ?? 0;
  const showChart = status === "ready" && payload && hasChartData(view, payload);
  const hoursNote = view.id === "hours" && payload?.hours?.note;

  return (
    <div
      className="stock-style-chart overview-stock-chart"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`overview-stock-chart__chrome ${fadeOut ? "overview-stock-chart__chrome--out" : ""}`}>
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
        className={`overview-stock-chart__plot-stage ${showChart ? "overview-stock-chart__plot-stage--live" : "overview-stock-chart__plot-stage--idle"}`}
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
              onClick={() => {
                setViewIndex(i);
                setFadeOut(false);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
