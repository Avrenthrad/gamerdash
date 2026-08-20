// Real price history chart via lightweight-charts (TradingView's own
// open-source lib) — renders whatever real snapshots this app has
// actually recorded for a card. No backfilled/fabricated data: a
// freshly-tracked card legitimately starts with 0-1 points, and this
// says so honestly instead of faking a curve.
//
// Stock-chart styling: a filled area (AreaSeries, not a bare line),
// colored by the REAL trend in the data passed in — green if the
// latest real snapshot is at or above the first one in range, red if
// it's below. This app has no other "gain/loss" concept anywhere else,
// so these two colors are introduced specifically for this purpose
// rather than reusing an unrelated existing token.
//
// compact=true renders a small axis-free sparkline (used by
// MtgPriceWatchPage's per-row trend at a glance) instead of the full
// chart with visible price/time scales (used by MtgPriceHistoryModal).

import { useEffect, useRef } from "react";
import { createChart, AreaSeries } from "lightweight-charts";

const UP_COLOR = "#22c55e";
const DOWN_COLOR = "#E8283D";

export default function PriceHistoryChart({ snapshots, compact = false }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const height = compact ? 48 : 200;

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { color: "transparent" }, textColor: "#8C8B90" },
      grid: {
        vertLines: { color: compact ? "transparent" : "rgba(255,255,255,0.06)" },
        horzLines: { color: compact ? "transparent" : "rgba(255,255,255,0.06)" },
      },
      timeScale: { borderColor: "rgba(255,255,255,0.12)", visible: !compact },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.12)", visible: !compact },
      crosshair: { mode: compact ? 1 : 0 },
      handleScroll: !compact,
      handleScale: !compact,
    });
    const series = chart.addSeries(AreaSeries, { lineWidth: 2 });
    apiRef.current = { chart, series };

    function handleResize() {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  useEffect(() => {
    if (!apiRef.current) return;
    // lightweight-charts requires strictly-increasing time values per
    // point. Real snapshots recorded moments apart (e.g. Scryfall's
    // usd/usd_foil and several Card Kingdom entries for one card, all
    // captured in the same batch) can land in the same whole second
    // once floored here — collapse those into one point (keeping the
    // last real value at that second) instead of crashing.
    const bySecond = new Map();
    for (const s of snapshots) {
      const time = Math.floor(new Date(s.captured_at).getTime() / 1000);
      bySecond.set(time, Number(s.price));
    }
    const data = [...bySecond.entries()]
      .sort(([a], [b]) => a - b)
      .map(([time, value]) => ({ time, value }));

    const first = data[0]?.value;
    const last = data[data.length - 1]?.value;
    const trendColor = first != null && last != null && last < first ? DOWN_COLOR : UP_COLOR;
    apiRef.current.series.applyOptions({
      lineColor: trendColor,
      topColor: `${trendColor}33`,
      bottomColor: `${trendColor}00`,
    });

    apiRef.current.series.setData(data);
    apiRef.current.chart.timeScale().fitContent();
  }, [snapshots]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
