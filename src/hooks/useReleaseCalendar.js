import { useEffect, useMemo, useState } from "react";
import { fetchUpcomingReleases } from "../lib/rawg";
import { fetchWishlistUpcoming, fetchOwnedGames } from "../lib/steam";
import {
  RELEASE_WINDOW_DAYS,
  buildReleasesByDate,
  mergeReleases,
} from "../lib/releaseCalendar";

export function useReleaseCalendar(wishlist, linkedSteamId) {
  const [rawgReleases, setRawgReleases] = useState([]);
  const [status, setStatus] = useState("loading");
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
    end.setDate(end.getDate() + RELEASE_WINDOW_DAYS);
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

  const releases = useMemo(
    () => mergeReleases(steamUpcoming, status === "ready" ? rawgReleases : [], wishlistTitles),
    [steamUpcoming, rawgReleases, status, wishlistTitles]
  );

  const releasesByDate = useMemo(() => buildReleasesByDate(releases), [releases]);

  const tagContext = useMemo(
    () => ({ ownedAppids, ownedNames }),
    [ownedAppids, ownedNames]
  );

  return {
    releases,
    releasesByDate,
    status,
    tagContext,
    showEmpty: releases.length === 0 && status !== "loading",
  };
}
