// Gaming dashboard — compact rolling "what's launching soon" preview,
// real RAWG release-date data (see lib/rawg.js), same source
// UpcomingReleasesPage uses for the full calendar. Deliberately date-
// level only ("in 3 days"), never a fabricated exact time — RAWG's
// `released` field is a date, not a timestamp, and no platform
// publishes a reliable free per-region unlock time to build a real
// live countdown from. Entries matching a title on the person's own
// wishlist get flagged, so it's part personal (your stuff), part
// general "what's coming" — same honest data either way.

import { useEffect, useState } from "react";
import { fetchUpcomingReleases } from "../lib/rawg";

const PREVIEW_COUNT = 6;
const WINDOW_DAYS = 60;

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

function countdownLabel(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export default function ReleaseCalendarCard({ wishlist, onOpenUpcomingReleases }) {
  const [releases, setReleases] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | no_key | error

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + WINDOW_DAYS);
    const fmt = (d) => d.toISOString().slice(0, 10);

    fetchUpcomingReleases({ dateFrom: fmt(today), dateTo: fmt(end), excludeAdditions: true })
      .then((result) => {
        if (cancelled) return;
        if (result === "no_key") {
          setStatus("no_key");
          return;
        }
        const sorted = [...result]
          .filter((g) => g.released)
          .sort((a, b) => new Date(a.released) - new Date(b.released))
          .slice(0, PREVIEW_COUNT);
        setReleases(sorted);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Release calendar fetch failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, []);

  const wishlistTitles = new Set((wishlist || []).map((w) => w.title.toLowerCase()));

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Release Calendar</span>
        <button type="button" className="linkish" onClick={onOpenUpcomingReleases}>View all →</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load upcoming releases right now.</p>}
      {status === "no_key" && <p className="panel__status">Upcoming releases aren't configured yet.</p>}
      {status === "ready" && releases.length === 0 && (
        <p className="panel__status">Nothing found releasing in the next {WINDOW_DAYS} days.</p>
      )}

      {status === "ready" && releases.length > 0 && (
        <ul className="release-calendar-list">
          {releases.map((game) => (
            <li key={game.id} className="release-calendar-row">
              <span className="release-calendar-row__countdown">{countdownLabel(daysUntil(game.released))}</span>
              <span className="release-calendar-row__name">{game.name}</span>
              {wishlistTitles.has(game.name.toLowerCase()) && (
                <span className="tag tag--rose-outline">Wishlisted</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
