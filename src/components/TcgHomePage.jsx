// TCG College hub — links to the real, built MTG and Flesh and Blood
// features, plus a real collection summary at the top when signed in.
//
// Unlike Gaming's per-platform ownership breakdown (which had to be
// left out entirely — no real data source exists for that), a rarity
// breakdown and estimated value for MTG here ARE honestly buildable:
// Scryfall gives real rarity and real pricing per card, and this
// project's own mtg_collection table already tracks real ownership/
// foil status. Deliberately does NOT show a value "trend" (e.g. "+12%
// this month") on this summary strip — that's what the dedicated Price
// Watch page is for, with real recorded history behind it.
//
// Flesh and Blood has no pricing source yet (deferred — see lib/fab.js),
// so its own summary only shows real counts, no dollar value.
//
// In-page game tab switcher (MTG | Flesh and Blood), same pattern
// TabletopHomePage.jsx already uses for RPG/Wargames/Dice/Rules —
// not a separate route/picker layer, since two games doesn't warrant
// an extra click.
//
// Other TCGs (Pokémon, One Piece, Riftbound, Yu-Gi-Oh) aren't built
// yet, shown honestly as such rather than omitted or faked.

import { useEffect, useState } from "react";
import { fetchCollection, enrichCollectionEntry } from "../lib/mtg";
import { fetchCollection as fetchFabCollection, enrichCollectionEntry as enrichFabCollectionEntry } from "../lib/fabCollection";

const MTG_FEATURES = [
  { id: "mtg-scan", label: "Scan Cards", icon: "📷", desc: "Free on-device text recognition, matched against real Scryfall data.", emphasized: true },
  { id: "mtg-search", label: "Card Search", icon: "🔍", desc: "Full Scryfall search — real cards, real pricing." },
  { id: "mtg-collection", label: "My Collection", icon: "📚", desc: "Real owned cards, real live pricing." },
  { id: "mtg-decks", label: "Deck Builder", icon: "🛠️", desc: "Real format-legality checking against Scryfall's own data." },
  { id: "mtg-price-watch", label: "Price Watch", icon: "📈", desc: "Real price trends across your whole collection, like a stock chart." },
  { id: "tcg-marketplace", label: "Marketplace", icon: "💰", desc: "Buy and sell real cards with other Lykodex users." },
];

const FAB_FEATURES = [
  { id: "fab-search", label: "Card Search", icon: "🔍", desc: "Real card data via goagain.dev's live Flesh and Blood API.", emphasized: true },
  { id: "fab-collection", label: "My Collection", icon: "📚", desc: "Real owned cards — no pricing shown yet." },
  { id: "tcg-marketplace", label: "Marketplace", icon: "💰", desc: "Buy and sell real cards with other Lykodex users." },
];

const OTHER_GAMES = ["Pokémon", "One Piece", "Riftbound", "Yu-Gi-Oh!"];

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"];
const RARITY_LABELS = { mythic: "Mythic", rare: "Rare", uncommon: "Uncommon", common: "Common" };

function MtgSummary({ isLoggedIn, userId }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    setStatus("loading");
    fetchCollection(userId)
      .then((rows) => Promise.all(rows.map(enrichCollectionEntry)))
      .then((enriched) => {
        setEntries(enriched);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("MTG collection summary fetch failed:", err);
        setStatus("error");
      });
  }, [isLoggedIn, userId]);

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);
  const rarityCounts = entries.reduce((acc, e) => {
    const rarity = e.card?.rarity;
    if (rarity) acc[rarity] = (acc[rarity] || 0) + e.quantity;
    return acc;
  }, {});
  const totalValue = entries.reduce((sum, e) => {
    const price = e.foil ? e.card?.prices?.usd_foil : e.card?.prices?.usd;
    return sum + (Number(price) || 0) * e.quantity;
  }, 0);

  if (!isLoggedIn || status !== "ready") return null;
  if (entries.length === 0) {
    return <p className="panel__status">No cards in your collection yet — start with Search or Scan below.</p>;
  }

  return (
    <div className="backlog-summary">
      <div className="panel__stat">
        <span className="panel__stat-value">{entries.length}</span>
        <span className="panel__stat-label">Unique cards</span>
      </div>
      <div className="panel__stat">
        <span className="panel__stat-value">{totalCards}</span>
        <span className="panel__stat-label">Total cards</span>
      </div>
      <div className="panel__stat">
        <span className="panel__stat-value">${totalValue.toFixed(2)}</span>
        <span className="panel__stat-label">Est. value (USD)</span>
      </div>
      {RARITY_ORDER.filter((r) => rarityCounts[r]).map((r) => (
        <div className="panel__stat" key={r}>
          <span className="panel__stat-value">{rarityCounts[r]}</span>
          <span className="panel__stat-label">{RARITY_LABELS[r]}</span>
        </div>
      ))}
    </div>
  );
}

function FabSummary({ isLoggedIn, userId }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    setStatus("loading");
    fetchFabCollection(userId)
      .then((rows) => Promise.all(rows.map(enrichFabCollectionEntry)))
      .then((enriched) => {
        setEntries(enriched);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Flesh and Blood collection summary fetch failed:", err);
        setStatus("error");
      });
  }, [isLoggedIn, userId]);

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);

  if (!isLoggedIn || status !== "ready") return null;
  if (entries.length === 0) {
    return <p className="panel__status">No cards in your collection yet — start with Search below.</p>;
  }

  return (
    <div className="backlog-summary">
      <div className="panel__stat">
        <span className="panel__stat-value">{entries.length}</span>
        <span className="panel__stat-label">Unique cards</span>
      </div>
      <div className="panel__stat">
        <span className="panel__stat-value">{totalCards}</span>
        <span className="panel__stat-label">Total cards</span>
      </div>
    </div>
  );
}

export default function TcgHomePage({ onNavigate, isLoggedIn, userId }) {
  const [game, setGame] = useState("mtg"); // mtg | fab
  const features = game === "mtg" ? MTG_FEATURES : FAB_FEATURES;

  return (
    <div className="price-page">
      <div className="price-page__head">
        <h1 className="price-page__title">TCG</h1>
        <p className="price-page__subtitle">Magic: The Gathering and Flesh and Blood are live — more TCGs coming soon.</p>
      </div>

      <div className="backlog-status-tabs">
        <button type="button" className={`quickdash-reset-btn ${game === "mtg" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setGame("mtg")}>Magic: The Gathering</button>
        <button type="button" className={`quickdash-reset-btn ${game === "fab" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setGame("fab")}>Flesh and Blood</button>
      </div>

      {game === "mtg" ? (
        <MtgSummary isLoggedIn={isLoggedIn} userId={userId} />
      ) : (
        <FabSummary isLoggedIn={isLoggedIn} userId={userId} />
      )}

      <div className="overview-grid">
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`overview-card ${f.emphasized ? "overview-card--emphasized" : ""}`}
            onClick={() => onNavigate(f.id)}
          >
            <span className="overview-card__icon">{f.icon}</span>
            <span className="overview-card__label">{f.label}</span>
            <span className="overview-card__empty">{f.desc}</span>
          </button>
        ))}
      </div>

      <p className="panel__status" style={{ marginTop: "24px" }}>
        Not built yet: {OTHER_GAMES.join(", ")}.
      </p>
    </div>
  );
}
