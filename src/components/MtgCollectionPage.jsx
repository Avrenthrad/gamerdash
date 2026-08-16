// Magic: The Gathering — My Collection. Real owned-card tracking with
// live pricing via Scryfall.

import { useEffect, useState } from "react";
import { fetchCollection, enrichCollectionEntry, updateCollectionEntry, removeFromCollection } from "../lib/mtg";

export default function MtgCollectionPage({ onBack, userId, onGoToSearch, onGoToScan }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!userId) return;
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadCollection() {
    setStatus("loading");
    try {
      const rows = await fetchCollection(userId);
      const enriched = await Promise.all(rows.map(enrichCollectionEntry));
      setEntries(enriched);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load MTG collection:", err);
      setStatus("error");
    }
  }

  async function handleQuantityChange(entry, newQuantity) {
    const qty = Math.max(0, Number(newQuantity) || 0);
    if (qty === 0) {
      await handleRemove(entry.id);
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, quantity: qty } : e)));
    try {
      await updateCollectionEntry(entry.id, { quantity: qty });
    } catch (err) {
      console.error("Failed to update quantity:", err);
    }
  }

  async function handleFoilToggle(entry) {
    const foil = !entry.foil;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, foil } : e)));
    try {
      await updateCollectionEntry(entry.id, { foil });
    } catch (err) {
      console.error("Failed to update foil status:", err);
    }
  }

  async function handleRemove(entryId) {
    try {
      await removeFromCollection(entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.error("Failed to remove card:", err);
    }
  }

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);
  const totalValue = entries.reduce((sum, e) => {
    const price = e.foil ? e.card?.prices?.usd_foil : e.card?.prices?.usd;
    return sum + (Number(price) || 0) * e.quantity;
  }, 0);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">My Collection</h1>
        <p className="price-page__subtitle">Real owned cards, real live pricing via Scryfall.</p>
      </div>

      {status === "ready" && entries.length > 0 && (
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
            <span className="panel__stat-label">Est. collection value (USD)</span>
          </div>
        </div>
      )}

      <div className="backlog-add">
        <button type="button" className="quickdash-reset-btn" onClick={onGoToScan}>
          📷 Scan a card
        </button>
        <button type="button" className="quickdash-reset-btn" onClick={onGoToSearch}>
          + Search &amp; add
        </button>
      </div>

      {status === "loading" && <p className="panel__status">Loading your collection…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your collection right now.</p>}
      {status === "ready" && entries.length === 0 && (
        <p className="panel__status">Nothing in your collection yet — search and add some cards.</p>
      )}

      {status === "ready" && entries.length > 0 && (
        <ul className="backlog-list">
          {entries.map((entry) => (
            <li key={entry.id} className="backlog-card">
              {entry.card?.imageSmall ? (
                <img src={entry.card.imageSmall} alt="" className="backlog-card__thumb" style={{ width: "56px", height: "78px" }} />
              ) : (
                <div className="backlog-card__thumb backlog-card__thumb--placeholder" style={{ width: "56px", height: "78px" }} />
              )}
              <div className="backlog-card__info">
                <span className="backlog-card__title">{entry.card_name}</span>
                <div className="backlog-card__meta">
                  <span>{entry.set_code?.toUpperCase()}</span>
                  {entry.card?.prices?.usd && !entry.foil && <span className="score-badge">${entry.card.prices.usd} each</span>}
                  {entry.card?.prices?.usd_foil && entry.foil && <span className="score-badge score-badge--preorder">${entry.card.prices.usd_foil} each (foil)</span>}
                </div>
                <div className="backlog-card__actions">
                  <label className="backlog-card__hours">
                    Qty:
                    <input
                      type="number"
                      min="0"
                      value={entry.quantity}
                      onChange={(e) => handleQuantityChange(entry, e.target.value)}
                      style={{ width: "48px" }}
                    />
                  </label>
                  <label className="backlog-card__hours">
                    <input type="checkbox" checked={entry.foil} onChange={() => handleFoilToggle(entry)} />
                    Foil
                  </label>
                </div>
              </div>
              <button type="button" className="game-popup__close" onClick={() => handleRemove(entry.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}

      <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        Card data and pricing powered by Scryfall
      </a>
    </div>
  );
}
