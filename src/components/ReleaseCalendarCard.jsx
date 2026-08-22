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
import { fetchWishlistUpcoming } from "../lib/steam";

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

export default function ReleaseCalendarCard({ wishlist, linkedSteamId, onOpenUpcomingReleases }) {
  const [releases, setReleases] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | no_key | error
  const [steamUpcoming, setSteamUpcoming] = useState([]); // real releases from the linked Steam wishlist

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

  // Steam's own logged-in-only Personal Calendar can't be reached from
  // here (see lib/steam.js's fetchWishlistUpcoming comment) — this is
  // the real, legitimately-reachable stand-in: your actual Steam
  // wishlist crossed with each game's actual Steam release date.
  useEffect(() => {
    if (!linkedSteamId) {
      setSteamUpcoming([]);
      return;
    }
    let cancelled = false;
    fetchWishlistUpcoming(linkedSteamId)
      .then((result) => {
        if (!cancelled) setSteamUpcoming(result.slice(0, PREVIEW_COUNT));
      })
      .catch((err) => {
        console.error("Steam wishlist release lookup failed:", err);
        if (!cancelled) setSteamUpcoming([]);
      });
    return () => { cancelled = true; };
  }, [linkedSteamId]);

  const wishlistTitles = new Set((wishlist || []).map((w) => w.title.toLowerCase()));

  // Steam-sourced entries are more accurate (real per-title release
  // dates, not RAWG's broader guess) and already known-wishlisted, so
  // they take priority — the general list only fills in titles Steam
  // didn't already cover.
  const steamNames = new Set(steamUpcoming.map((g) => g.name.toLowerCase()));
  const generalReleases = releases.filter((g) => !steamNames.has(g.name.toLowerCase()));

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Release Calendar</span>
        <button type="button" className="linkish" onClick={onOpenUpcomingReleases}>View all →</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load upcoming releases right now.</p>}
      {status === "no_key" && steamUpcoming.length === 0 && (
        <p className="panel__status">Upcoming releases aren't configured yet.</p>
      )}
      {(status === "ready" || status === "no_key") && generalReleases.length === 0 && steamUpcoming.length === 0 && (
        <p className="panel__status">Nothing found releasing in the next {WINDOW_DAYS} days.</p>
      )}

      {(steamUpcoming.length > 0 || generalReleases.length > 0) && (
        <ul className="release-calendar-list">
          {steamUpcoming.map((game) => (
            <li key={`steam-${game.appid}`} className="release-calendar-row">
              <span className="release-calendar-row__countdown">{countdownLabel(daysUntil(game.releaseDate))}</span>
              <span className="release-calendar-row__name">{game.name}</span>
              <span className="tag tag--amber-outline">Steam Wishlist</span>
            </li>
          ))}
          {status === "ready" && generalReleases.map((game) => (
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
