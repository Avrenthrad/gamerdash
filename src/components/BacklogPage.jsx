// Backlog / To Be Played — a dedicated page linked from Collections.
//
// Real data throughout except one explicitly self-reported field (see
// lib/backlog.js and schema.sql for why "length" can't come from a
// real API — HowLongToBeat has never published one, and this project
// doesn't use unofficial scrapers of it, the same line held for PSN
// trophies and Xbox achievements elsewhere in this app).
//
// Status tracking (Backlog/Playing/Completed/Dropped) and the
// "Surprise me" picker are both grounded in real research, not just
// assumed: every competitor backlog tracker uses the same 4-state
// model, and "choice paralysis" — not knowing what to play next — is
// one of the most consistently repeated complaints across gaming
// communities. Kept deliberately lightweight and dismissible rather
// than a demanding checklist — research also surfaced real pushback
// against backlog tracking that feels like pressure instead of fun.

import { useEffect, useState } from "react";
import { fetchOwnedGames, searchSteamGames } from "../lib/steam";
import { logActivityForUser } from "../lib/guilds";
import {
  fetchBacklog,
  addToBacklog,
  removeFromBacklog,
  setHoursEstimate,
  setBacklogStatus,
  enrichBacklogItem,
  STATUSES,
  STATUS_LABELS,
} from "../lib/backlog";

const SORT_OPTIONS = [
  { value: "rating", label: "Rating" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "releaseDate", label: "Release date" },
  { value: "length", label: "Length (self-reported)" },
];

const FILTER_OPTIONS = ["all", ...STATUSES];

// Owned games under 2 hours playtime are reasonable "haven't really
// started this" candidates to suggest for import — not a claim about
// what the person has or hasn't actually experienced, just a filter
// to keep the import list from being their entire library.
const LOW_PLAYTIME_THRESHOLD_MINUTES = 120;

export default function BacklogPage({ onBack, userId, linkedSteamId }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // page load state: loading | ready | error
  const [sortBy, setSortBy] = useState("rating");
  const [statusFilter, setStatusFilter] = useState("backlog");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [importCandidates, setImportCandidates] = useState([]);
  const [importLoaded, setImportLoaded] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [surpriseItem, setSurpriseItem] = useState(null);

  async function loadBacklog() {
    setStatus("loading");
    try {
      const rows = await fetchBacklog(userId);
      const enriched = await Promise.all(rows.map((r) => enrichBacklogItem(r, linkedSteamId)));
      setItems(enriched);
      setStatus("ready");
    } catch (err) {
      console.error("Backlog load failed:", err);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (userId) loadBacklog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const results = await searchSteamGames(searchTerm.trim());
      setSearchResults(results.slice(0, 8));
    } catch (err) {
      console.error("Backlog search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(title, appid) {
    try {
      await addToBacklog(userId, title, appid);
      setSearchResults((prev) => prev.filter((r) => r.id !== appid));
      loadBacklog();
    } catch (err) {
      console.error("Failed to add to backlog:", err);
    }
  }

  async function loadImportCandidates() {
    setShowImport(true);
    if (importLoaded || !linkedSteamId) return;
    try {
      const games = await fetchOwnedGames(linkedSteamId);
      const alreadyAdded = new Set(items.map((i) => i.steam_appid));
      const candidates = games
        .filter((g) => (g.playtime_forever || 0) <= LOW_PLAYTIME_THRESHOLD_MINUTES)
        .filter((g) => !alreadyAdded.has(String(g.appid)))
        .sort((a, b) => a.name.localeCompare(b.name));
      setImportCandidates(candidates);
      setImportLoaded(true);
    } catch (err) {
      console.error("Failed to load Steam library for import:", err);
    }
  }

  async function handleImport(game) {
    try {
      await addToBacklog(userId, game.name, game.appid);
      setImportCandidates((prev) => prev.filter((g) => g.appid !== game.appid));
      loadBacklog();
    } catch (err) {
      console.error("Failed to import game:", err);
    }
  }

  async function handleRemove(itemId) {
    try {
      await removeFromBacklog(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      console.error("Failed to remove backlog item:", err);
    }
  }

  async function handleHoursChange(itemId, value) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, hours_estimate: value } : i)));
    try {
      await setHoursEstimate(itemId, value);
    } catch (err) {
      console.error("Failed to save hours estimate:", err);
    }
  }

  async function handleStatusChange(itemId, newStatus) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i)));
    try {
      await setBacklogStatus(itemId, newStatus);
      const item = items.find((i) => i.id === itemId);
      if (item) {
        logActivityForUser(userId, "backlog_status_change", {
          title: `${item.title} → ${STATUS_LABELS[newStatus]}`,
        });
      }
    } catch (err) {
      console.error("Failed to save status:", err);
    }
  }

  function handleSurpriseMe() {
    const candidates = items.filter((i) => (i.status || "backlog") === "backlog");
    if (candidates.length === 0) {
      setSurpriseItem(null);
      return;
    }
    setSurpriseItem(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  const filteredItems = statusFilter === "all"
    ? items
    : items.filter((i) => (i.status || "backlog") === statusFilter);

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "alphabetical") return a.title.localeCompare(b.title);
    if (sortBy === "rating") return (b.metacriticScore ?? -1) - (a.metacriticScore ?? -1);
    if (sortBy === "releaseDate") return (b.releaseDate ? new Date(b.releaseDate) : 0) - (a.releaseDate ? new Date(a.releaseDate) : 0);
    if (sortBy === "length") return (b.hours_estimate ?? -1) - (a.hours_estimate ?? -1);
    return 0;
  });

  const totalAchievements = items.reduce((sum, i) => sum + (i.totalAchievements || 0), 0);
  const totalEstimatedHours = items.reduce((sum, i) => sum + (Number(i.hours_estimate) || 0), 0);
  const itemsWithEstimate = items.filter((i) => i.hours_estimate != null).length;
  const backlogCount = items.filter((i) => (i.status || "backlog") === "backlog").length;

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Collections</button>
        <h1 className="price-page__title">Backlog / To Be Played</h1>
        <p className="price-page__subtitle">
          Real ratings, release dates, and achievement counts throughout. "Length" has no
          legitimate public data source (see below) — self-reported only, clearly marked.
        </p>
      </div>

      {status === "ready" && (
        <div className="backlog-summary">
          <div className="panel__stat">
            <span className="panel__stat-value">{items.length}</span>
            <span className="panel__stat-label">Games</span>
          </div>
          <div className="panel__stat">
            <span className="panel__stat-value">{totalAchievements.toLocaleString()}</span>
            <span className="panel__stat-label">Achievements available</span>
          </div>
          <div className="panel__stat">
            <span className="panel__stat-value">{totalEstimatedHours.toLocaleString()}h</span>
            <span className="panel__stat-label">
              Est. hours {itemsWithEstimate < items.length && itemsWithEstimate > 0 ? `(${itemsWithEstimate} of ${items.length} reported)` : ""}
            </span>
          </div>
        </div>
      )}

      {status === "ready" && backlogCount > 0 && (
        <div className="surprise-me">
          <button type="button" className="price-search__button" onClick={handleSurpriseMe}>
            🎲 What should I play next?
          </button>
          {surpriseItem && (
            <div className="surprise-me__result">
              {surpriseItem.thumb && <img src={surpriseItem.thumb} alt="" />}
              <span className="surprise-me__title">{surpriseItem.title}</span>
              <button
                type="button"
                className="quickdash-reset-btn"
                onClick={() => handleStatusChange(surpriseItem.id, "playing")}
              >
                Start playing
              </button>
              <button type="button" className="quickdash-reset-btn" onClick={handleSurpriseMe}>
                Pick again
              </button>
              <button type="button" className="game-popup__close" onClick={() => setSurpriseItem(null)} aria-label="Dismiss">✕</button>
            </div>
          )}
        </div>
      )}

      <div className="backlog-add">
        <form className="price-search" onSubmit={handleSearch}>
          <input
            className="price-search__input"
            type="text"
            placeholder="Search a game to add…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="price-search__button" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {searchResults.length > 0 && (
          <ul className="backlog-search-results">
            {searchResults.map((r) => (
              <li key={r.id} className="backlog-search-results__row">
                {r.tiny_image && <img src={r.tiny_image} alt="" />}
                <span>{r.name}</span>
                <button type="button" className="linking-row__connect" onClick={() => handleAdd(r.name, r.id)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}

        {linkedSteamId && (
          <button type="button" className="quickdash-reset-btn" onClick={loadImportCandidates}>
            {showImport ? "Import from Steam library" : "Import from Steam library ▾"}
          </button>
        )}

        {showImport && (
          <div className="backlog-import">
            {!importLoaded && <p className="panel__status">Loading your library…</p>}
            {importLoaded && importCandidates.length === 0 && (
              <p className="panel__status">No low-playtime games found to suggest — your backlog's already caught up, or everything's added.</p>
            )}
            {importLoaded && importCandidates.length > 0 && (
              <ul className="backlog-search-results">
                {importCandidates.slice(0, 20).map((g) => (
                  <li key={g.appid} className="backlog-search-results__row">
                    <span>{g.name}</span>
                    <button type="button" className="linking-row__connect" onClick={() => handleImport(g)}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {status === "ready" && items.length > 0 && (
        <div className="backlog-add">
          <div className="backlog-status-tabs">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={`quickdash-reset-btn ${statusFilter === f ? "quickdash-reset-btn--active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === "all" ? "All" : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
          <label className="currency-picker">
            <span>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {status === "loading" && <p className="panel__status">Loading your backlog…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your backlog right now.</p>}
      {status === "ready" && items.length === 0 && (
        <p className="panel__status">Nothing in your backlog yet — search or import above.</p>
      )}
      {status === "ready" && items.length > 0 && filteredItems.length === 0 && (
        <p className="panel__status">Nothing with this status yet.</p>
      )}

      {status === "ready" && filteredItems.length > 0 && (
        <ul className="backlog-list">
          {sortedItems.map((item) => (
            <li key={item.id} className="backlog-card">
              {item.thumb ? (
                <img src={item.thumb} alt="" className="backlog-card__thumb" />
              ) : (
                <div className="backlog-card__thumb backlog-card__thumb--placeholder" />
              )}
              <div className="backlog-card__info">
                <span className="backlog-card__title">{item.title}</span>
                <div className="backlog-card__meta">
                  {item.metacriticScore != null && <span className="score-badge">Metacritic {item.metacriticScore}</span>}
                  {item.releaseDate && <span>{item.releaseDate}</span>}
                  {item.totalAchievements != null && item.totalAchievements > 0 && (
                    <span>
                      {item.unlockedAchievements != null ? `${item.unlockedAchievements}/` : ""}
                      {item.totalAchievements} achievements
                    </span>
                  )}
                </div>
                <div className="backlog-card__actions">
                  <select
                    className="backlog-card__status-select"
                    value={item.status || "backlog"}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <label className="backlog-card__hours">
                    Your estimate:
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="hours"
                      value={item.hours_estimate ?? ""}
                      onChange={(e) => handleHoursChange(item.id, e.target.value)}
                    />
                    h
                  </label>
                  <a
                    href={`https://howlongtobeat.com/?q=${encodeURIComponent(item.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="backlog-card__hltb-link"
                  >
                    Check on HowLongToBeat ↗
                  </a>
                </div>
              </div>
              <button type="button" className="game-popup__close" onClick={() => handleRemove(item.id)} aria-label="Remove from backlog">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
