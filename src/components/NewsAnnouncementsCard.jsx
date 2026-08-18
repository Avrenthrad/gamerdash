// Gaming dashboard — real dev-posted announcements (patch notes, beta
// access, preorder/launch news) for whatever's actually in the
// person's Steam library, via lib/steam.js's fetchNewsForApp (Steam's
// own public GetNewsForApp endpoint — no key, no scrape).
//
// Deliberately scoped to library games, not the wishlist: wishlist
// entries only ever store a title (see wishlist_items in schema.sql),
// so getting a real appid for one means an extra fuzzy title-to-appid
// resolve step that can mismatch. Owned games already carry a real
// appid straight from Steam, so this reads from there instead — the
// most-played few, on the same theory ContinuePlayingCard/Library use
// elsewhere, since scanning someone's whole library for news isn't
// worth the API calls.
//
// Also honestly scoped to Steam only: no other platform this project
// touches (Xbox, PlayStation) has an equivalent public feed to pull
// real per-game announcements from, and a general gaming-news
// aggregator has no honest free source either — confirmed while
// researching this feature.

import { useEffect, useState } from "react";
import { fetchOwnedGames, fetchNewsForApp } from "../lib/steam";

const GAMES_TO_CHECK = 3;
const ITEMS_PER_GAME = 2;
const PREVIEW_COUNT = 5;

function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NewsAnnouncementsCard({ linkedSteamId }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | no_steam

  useEffect(() => {
    if (!linkedSteamId) {
      setStatus("no_steam");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    fetchOwnedGames(linkedSteamId)
      .then(async (games) => {
        const top = [...games]
          .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
          .slice(0, GAMES_TO_CHECK);

        const perGame = await Promise.all(
          top.map((g) =>
            fetchNewsForApp(g.appid, ITEMS_PER_GAME)
              .then((news) => news.map((n) => ({ ...n, gameName: g.name })))
              .catch(() => [])
          )
        );

        if (cancelled) return;
        const combined = perGame
          .flat()
          .filter((n) => n.date)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, PREVIEW_COUNT);
        setItems(combined);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("News/Announcements fetch failed:", err);
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [linkedSteamId]);

  return (
    <div className="panel hero-card">
      <div className="panel__head">
        <span className="panel__eyebrow">News &amp; Announcements</span>
      </div>

      {status === "no_steam" && <p className="panel__status">Link Steam to see real announcements for your games.</p>}
      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load announcements right now.</p>}
      {status === "ready" && items.length === 0 && (
        <p className="panel__status">No recent announcements found for your most-played games.</p>
      )}

      {status === "ready" && items.length > 0 && (
        <ul className="news-announcements-list">
          {items.map((item) => (
            <li key={item.id} className="news-announcements-row">
              <a href={item.url} target="_blank" rel="noreferrer" className="news-announcements-row__title">
                {item.title}
              </a>
              <span className="news-announcements-row__meta">{item.gameName} · {relativeDate(item.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
