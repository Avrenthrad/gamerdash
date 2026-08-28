// Universal command palette — Ctrl/Cmd+K, or the header search icon.
// Searches real, already-loaded user data across every College at
// once: Gaming library (if Steam is linked), TCG cards/decks/binders,
// Entertainment entries, Collectibles, Tabletop campaigns/armies —
// plus the app's own pages (see data/navIndex.js). Nothing here is
// invented: an empty College just contributes nothing to the results,
// same honest-empty-state principle as everywhere else in this app.
//
// Data is fetched once per palette session (first open after login/
// Steam-link change) and filtered client-side as you type — these are
// all "my own" bounded datasets, not worth a network round trip per
// keystroke.

import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_INDEX } from "../data/navIndex";
import { fetchOwnedGames } from "../lib/steam";
import { fetchCollection, fetchDecks, fetchBinders } from "../lib/mtg";
import { fetchEntertainmentEntries } from "../lib/entertainment";
import { fetchCollectibles } from "../lib/collectibles";
import { fetchCampaigns, fetchArmies } from "../lib/tabletop";

const RECENTS_KEY = "gd-palette-recents";
const MAX_RECENTS = 5;
const MAX_RESULTS = 30;

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry) {
  try {
    const prev = loadRecents().filter((r) => !(r.view === entry.view && r.label === entry.label));
    const next = [entry, ...prev].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const TYPE_ICON = {
  page: "🧭",
  game: "🎮",
  mtg_card: "🃏",
  mtg_deck: "🛠️",
  mtg_binder: "📁",
  movie: "🎬",
  tv: "📺",
  anime: "🎴",
  book: "📖",
  collectible: "⭐",
  campaign: "🎲",
  army: "⚔️",
};

async function loadPaletteData(userId, linkedSteamId) {
  const [games, cards, decks, binders, entertainment, collectibles, campaigns, armies] = await Promise.all([
    linkedSteamId ? fetchOwnedGames(linkedSteamId).catch(() => []) : Promise.resolve([]),
    userId ? fetchCollection(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchDecks(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchBinders(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchEntertainmentEntries(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchCollectibles(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchCampaigns(userId).catch(() => []) : Promise.resolve([]),
    userId ? fetchArmies(userId).catch(() => []) : Promise.resolve([]),
  ]);

  const items = [];

  for (const g of games) {
    items.push({ type: "game", label: g.name, sublabel: "Gaming · Library", view: "library", key: `game-${g.appid}` });
  }
  for (const c of cards) {
    items.push({ type: "mtg_card", label: c.card_name, sublabel: `TCG · ${c.set_code?.toUpperCase() || "Collection"}`, view: "mtg-collection", key: `card-${c.id}` });
  }
  for (const d of decks) {
    items.push({ type: "mtg_deck", label: d.name, sublabel: `TCG · ${d.format} deck`, view: "mtg-decks", key: `deck-${d.id}` });
  }
  for (const b of binders) {
    items.push({
      type: "mtg_binder",
      label: b.name,
      sublabel: `TCG · ${b.kind === "set_list" ? "Set list" : "Binder"}`,
      view: "mtg-collection",
      key: `binder-${b.id}`,
    });
  }
  for (const e of entertainment) {
    items.push({
      type: e.media_kind === "movie" ? "movie" : e.media_kind === "tv" ? "tv" : e.media_kind === "anime" ? "anime" : "book",
      label: e.title,
      sublabel: `Library · ${e.media_kind}`,
      view: "college-entertainment",
      key: `ent-${e.id}`,
    });
  }
  for (const c of collectibles) {
    items.push({ type: "collectible", label: c.title, sublabel: `Loot · ${c.type?.replace(/_/g, " ") || ""}`, view: "college-collectibles", key: `col-${c.id}` });
  }
  for (const c of campaigns) {
    items.push({ type: "campaign", label: c.name, sublabel: "Wartable · Campaign", view: "college-tabletop", key: `camp-${c.id}` });
  }
  for (const a of armies) {
    items.push({ type: "army", label: a.name, sublabel: `Wartable · ${a.faction || "Army"}`, view: "college-tabletop", key: `army-${a.id}` });
  }

  return items;
}

export default function CommandPalette({ isOpen, onClose, onNavigateView, isLoggedIn, userId, linkedSteamId }) {
  const [query, setQuery] = useState("");
  const [dataItems, setDataItems] = useState([]);
  const [dataStatus, setDataStatus] = useState("idle"); // idle | loading | ready | error
  const [highlighted, setHighlighted] = useState(0);
  const [recents, setRecents] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setHighlighted(0);
    setRecents(loadRecents());
    requestAnimationFrame(() => inputRef.current?.focus());

    if (isLoggedIn && dataStatus === "idle") {
      setDataStatus("loading");
      loadPaletteData(userId, linkedSteamId)
        .then((items) => {
          setDataItems(items);
          setDataStatus("ready");
        })
        .catch((err) => {
          console.error("Command palette data load failed:", err);
          setDataStatus("error");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Re-fetch if the signed-in identity or Steam link changes between
  // opens — stale results from a previous account would be worse than
  // a brief re-load.
  useEffect(() => {
    setDataItems([]);
    setDataStatus("idle");
  }, [userId, linkedSteamId]);

  const navResults = useMemo(
    () => NAV_INDEX.map((n) => ({ type: "page", label: n.label, sublabel: "Go to page", view: n.view, key: `nav-${n.view}`, keywords: n.keywords })),
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...navResults, ...dataItems];
    if (!q) return [];
    return all
      .filter((item) => item.label?.toLowerCase().includes(q) || item.keywords?.includes(q) || item.sublabel?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, navResults, dataItems]);

  function handleSelect(item) {
    saveRecent({ label: item.label, sublabel: item.sublabel, view: item.view, type: item.type });
    onNavigateView(item.view);
    onClose();
  }

  function handleKeyDown(e) {
    const list = query.trim() ? results : recents;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list[highlighted]) handleSelect(list[highlighted]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!isOpen) return null;

  const showingRecents = !query.trim();

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search Lykodex">
        <div className="cmdk__input-row">
          <span className="cmdk__input-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmdk__input"
            placeholder="Search games, cards, decks, binders, movies, campaigns…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmdk__esc">Esc</kbd>
        </div>

        {!isLoggedIn && (
          <p className="cmdk__hint">Sign in to search your library, collection, and everything else you track.</p>
        )}

        {isLoggedIn && dataStatus === "loading" && query.trim() && (
          <p className="cmdk__hint">Still loading your data — page results are searchable now, everything else in a moment…</p>
        )}

        {showingRecents && recents.length > 0 && (
          <div className="cmdk__section">
            <span className="cmdk__section-label">Recent</span>
            <ul className="cmdk__list">
              {recents.map((item, i) => (
                <li key={`${item.view}-${item.label}-${i}`}>
                  <button
                    type="button"
                    className={`cmdk__item ${highlighted === i ? "cmdk__item--active" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <span className="cmdk__item-icon" aria-hidden="true">{TYPE_ICON[item.type] || "🧭"}</span>
                    <span className="cmdk__item-text">
                      <span className="cmdk__item-label">{item.label}</span>
                      {item.sublabel && <span className="cmdk__item-sublabel">{item.sublabel}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showingRecents && recents.length === 0 && (
          <div className="cmdk__empty">
            <span className="cmdk__empty-icon" aria-hidden="true">🔎</span>
            <p>Start typing to search across every College — your library, cards, collection, and more.</p>
          </div>
        )}

        {!showingRecents && (
          <div className="cmdk__section">
            {results.length === 0 ? (
              <p className="cmdk__hint">No matches for "{query}".</p>
            ) : (
              <ul className="cmdk__list">
                {results.map((item, i) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`cmdk__item ${highlighted === i ? "cmdk__item--active" : ""}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setHighlighted(i)}
                    >
                      <span className="cmdk__item-icon" aria-hidden="true">{TYPE_ICON[item.type] || "🧭"}</span>
                      <span className="cmdk__item-text">
                        <span className="cmdk__item-label">{item.label}</span>
                        {item.sublabel && <span className="cmdk__item-sublabel">{item.sublabel}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
