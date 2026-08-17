// Gaming dashboard — real Steam "top played" chart (same source
// HypeChartsPage.jsx uses for the full 100), trimmed to a top-5
// preview and resolved eagerly since it's above the fold here.

import { useEffect, useState } from "react";
import { fetchTopPlayedGames, resolveGameName } from "../lib/steam";

const PREVIEW_COUNT = 5;

export default function NowTrendingCard({ onOpenHypeCharts }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    fetchTopPlayedGames()
      .then(async (ranks) => {
        const top = ranks.slice(0, PREVIEW_COUNT);
        const infos = await Promise.all(
          top.map((r) => resolveGameName(r.appid).catch(() => ({ name: null })))
        );
        if (cancelled) return;
        setRows(top.map((r, i) => ({ ...r, name: infos[i]?.name || `App #${r.appid}` })));
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Now Trending fetch failed:", err);
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Now Trending</span>
        <button type="button" className="linkish" onClick={onOpenHypeCharts}>View all →</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load Steam's charts right now.</p>}

      {status === "ready" && (
        <ol className="trending-list">
          {rows.map((row) => (
            <li key={row.appid} className="trending-row">
              <span className="trending-row__rank">{row.rank}</span>
              <span className="trending-row__name">{row.name}</span>
              <span className="trending-row__count">
                {(row.concurrent_in_game ?? row.peak_in_game ?? row.players ?? null)?.toLocaleString() ?? "—"} playing
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
