// Gaming dashboard — compact rolling "what's launching soon" preview,
// real RAWG release-date data (see lib/rawg.js), same source
// UpcomingReleasesPage uses for the full calendar. Deliberately date-
// level only ("in 3 days"), never a fabricated exact time — RAWG's
// `released` field is a date, not a timestamp, and no platform
// publishes a reliable free per-region unlock time to build a real
// live countdown from. Entries matching a title on the person's own
// wishlist get flagged, so it's part personal (your stuff), part
// general "what's coming" — same honest data either way.

import { useEffect, useMemo, useState } from "react";
import { fetchUpcomingReleases } from "../lib/rawg";
import { fetchWishlistUpcoming, fetchOwnedGames } from "../lib/steam";

const PREVIEW_COUNT = 10;
const WINDOW_DAYS = 120;

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

function formatReleaseDate(dateStr) {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return "";
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function urgencyClass(days) {
  if (days <= 0) return "release-calendar-row--today";
  if (days <= 7) return "release-calendar-row--soon";
  if (days <= 30) return "release-calendar-row--near";
  return "";
}

function buildStatusTags(entry, { ownedAppids, ownedNames }) {
  const owned = entry.appid
    ? ownedAppids.has(entry.appid)
    : ownedNames.has(entry.name.toLowerCase());

  if (owned) {
    return [{ key: "purchased", label: "Steam Purchased", className: "tag tag--steam-purchased" }];
  }

  const tags = [];
  if (entry.isSteamWishlist) {
    tags.push({ key: "steam-wishlist", label: "Steam Wishlist", className: "tag tag--amber-outline" });
  } else if (entry.isLykodexWishlist) {
    tags.push({ key: "wishlisted", label: "Wishlisted", className: "tag tag--rose-outline" });
  }

  const platform = entry.platforms?.[0];
  if (platform && !entry.isSteamWishlist) {
    tags.push({ key: `platform-${platform}`, label: platform, className: "tag tag--platform" });
  }

  return tags;
}

function mergeReleases(steamUpcoming, rawgReleases, wishlistTitles) {
  const byName = new Map();

  for (const game of steamUpcoming) {
    const key = game.name.toLowerCase();
    byName.set(key, {
      id: `steam-${game.appid}`,
      appid: game.appid,
      name: game.name,
      releaseDate: game.releaseDate,
      isSteamWishlist: true,
      isLykodexWishlist: wishlistTitles.has(key),
      platforms: ["Steam"],
    });
  }

  for (const game of rawgReleases) {
    const key = game.name.toLowerCase();
    if (byName.has(key)) continue;
    byName.set(key, {
      id: `rawg-${game.id}`,
      name: game.name,
      releaseDate: game.released,
      isSteamWishlist: false,
      isLykodexWishlist: wishlistTitles.has(key),
      platforms: game.platforms || [],
    });
  }

  return [...byName.values()]
    .filter((entry) => entry.releaseDate && daysUntil(entry.releaseDate) >= 0)
    .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate))
    .slice(0, PREVIEW_COUNT);
}

export default function ReleaseCalendarCard({ wishlist, linkedSteamId, onOpenUpcomingReleases }) {
  const [rawgReleases, setRawgReleases] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | no_key | error
  const [steamUpcoming, setSteamUpcoming] = useState([]);
  const [ownedAppids, setOwnedAppids] = useState(new Set());
  const [ownedNames, setOwnedNames] = useState(new Set());

  const wishlistTitles = useMemo(
    () => new Set((wishlist || []).map((w) => w.title.toLowerCase())),
    [wishlist]
  );

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
        setRawgReleases(
          [...result]
            .filter((g) => g.released)
            .sort((a, b) => new Date(a.released) - new Date(b.released))
        );
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Release calendar fetch failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!linkedSteamId) {
      setSteamUpcoming([]);
      return;
    }
    let cancelled = false;
    fetchWishlistUpcoming(linkedSteamId, 80)
      .then((result) => {
        if (!cancelled) setSteamUpcoming(result);
      })
      .catch((err) => {
        console.error("Steam wishlist release lookup failed:", err);
        if (!cancelled) setSteamUpcoming([]);
      });
    return () => { cancelled = true; };
  }, [linkedSteamId]);

  useEffect(() => {
    if (!linkedSteamId) {
      setOwnedAppids(new Set());
      setOwnedNames(new Set());
      return;
    }
    let cancelled = false;
    fetchOwnedGames(linkedSteamId)
      .then((games) => {
        if (cancelled) return;
        setOwnedAppids(new Set(games.map((g) => g.appid)));
        setOwnedNames(new Set(games.map((g) => g.name.toLowerCase())));
      })
      .catch((err) => {
        console.error("Steam library lookup failed:", err);
        if (!cancelled) {
          setOwnedAppids(new Set());
          setOwnedNames(new Set());
        }
      });
    return () => { cancelled = true; };
  }, [linkedSteamId]);

  const preview = useMemo(
    () => mergeReleases(steamUpcoming, status === "ready" ? rawgReleases : [], wishlistTitles),
    [steamUpcoming, rawgReleases, status, wishlistTitles]
  );

  const tagContext = { ownedAppids, ownedNames };
  const showEmpty = preview.length === 0 && status !== "loading";

  return (
    <div className="panel hero-card release-calendar-card">
      <div className="panel__head">
        <span className="panel__eyebrow">Release Calendar</span>
        <button type="button" className="linkish" onClick={onOpenUpcomingReleases}>View all →</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading upcoming releases…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load upcoming releases right now.</p>}
      {status === "no_key" && showEmpty && (
        <p className="panel__status">Upcoming releases aren't configured yet.</p>
      )}
      {showEmpty && status !== "error" && status !== "loading" && (
        <p className="panel__status">Nothing releasing in the next {WINDOW_DAYS} days.</p>
      )}

      {preview.length > 0 && (
        <ul className="release-calendar-list">
          {preview.map((entry) => {
            const days = daysUntil(entry.releaseDate);
            const tags = buildStatusTags(entry, tagContext);

            return (
              <li
                key={entry.id}
                className={`release-calendar-row ${urgencyClass(days)}`}
              >
                <div className="release-calendar-row__when">
                  <span className="release-calendar-row__countdown">{countdownLabel(days)}</span>
                  <span className="release-calendar-row__date">{formatReleaseDate(entry.releaseDate)}</span>
                </div>
                <span className="release-calendar-row__name" title={entry.name}>{entry.name}</span>
                <div className="release-calendar-row__tags">
                  {tags.map((tag) => (
                    <span key={tag.key} className={tag.className}>{tag.label}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
