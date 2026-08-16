// Real price history chart via lightweight-charts (TradingView's own
// open-source lib) — renders whatever real snapshots this app has
// actually recorded for a card. No backfilled/fabricated data: a
// freshly-tracked card legitimately starts with 0-1 points, and this
// says so honestly instead of faking a curve.

import { useEffect, useRef } from "react";
import { createChart, LineSeries } from "lightweight-charts";

export default function PriceHistoryChart({ snapshots }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 200,
      layout: { background: { color: "transparent" }, textColor: "#8C8B90" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: { borderColor: "rgba(255,255,255,0.12)" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(LineSeries, { color: "#E8283D", lineWidth: 2 });
    apiRef.current = { chart, series };

    function handleResize() {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!apiRef.current) return;
    const data = snapshots.map((s) => ({
      time: Math.floor(new Date(s.captured_at).getTime() / 1000),
      value: Number(s.price),
    }));
    apiRef.current.series.setData(data);
    apiRef.current.chart.timeScale().fitContent();
  }, [snapshots]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
