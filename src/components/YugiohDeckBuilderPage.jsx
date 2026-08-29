// Yu-Gi-Oh! — Deck Builder. Real per-format banlist checking using
// YGOPRODeck's own banlist_info per card (TCG/OCG/GOAT) — unlike mtg/
// pokemon's plain legal/illegal flag, a card can be legal-but-capped
// ("Limited" = max 1, "Semi-Limited" = max 2), so violations list a
// copy-count problem, not just an outright ban.

import { useEffect, useState } from "react";
import { searchYugiohCards } from "../lib/yugioh";
import {
  fetchDecks, createDeck, deleteDeck, updateDeck,
  fetchDeckCards, addCardToDeck, updateDeckCardQuantity, removeCardFromDeck,
  checkYugiohDeckLegality,
} from "../lib/yugiohCollection";

const FORMATS = [
  { id: "tcg", label: "TCG" },
  { id: "ocg", label: "OCG" },
  { id: "goat", label: "GOAT" },
];

export default function YugiohDeckBuilderPage({ onBack, userId }) {
  const [decks, setDecks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeDeckId, setActiveDeckId] = useState(null);

  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("tcg");

  const [deckCards, setDeckCards] = useState([]);
  const [violations, setViolations] = useState([]);
  const [deckCardsStatus, setDeckCardsStatus] = useState("idle");

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  const [labelsInput, setLabelsInput] = useState("");

  useEffect(() => {
    if (!userId) return;
    loadDecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function loadDecks() {
    setStatus("loading");
    try {
      const rows = await fetchDecks(userId);
      setDecks(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load decks:", err);
      setStatus("error");
    }
  }

  async function handleCreateDeck(e) {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    try {
      const deck = await createDeck(userId, newDeckName.trim(), newDeckFormat);
      setNewDeckName("");
      setDecks((prev) => [deck, ...prev]);
      openDeck(deck.id, deck);
    } catch (err) {
      console.error("Failed to create deck:", err);
    }
  }

  async function handleDeleteDeck(deckId) {
    try {
      await deleteDeck(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      if (activeDeckId === deckId) setActiveDeckId(null);
    } catch (err) {
      console.error("Failed to delete deck:", err);
    }
  }

  async function openDeck(deckId, deckOverride) {
    setActiveDeckId(deckId);
    setDeckCardsStatus("loading");
    const deck = deckOverride || decks.find((d) => d.id === deckId);
    setLabelsInput((deck?.labels || []).join(", "));
    try {
      const cards = await fetchDeckCards(deckId);
      setDeckCards(cards);
      const { violations: v } = await checkYugiohDeckLegality(cards, deck?.format || "tcg");
      setViolations(v);
      setDeckCardsStatus("ready");
    } catch (err) {
      console.error("Failed to load deck cards:", err);
      setDeckCardsStatus("error");
    }
  }

  function handleLabelsBlur() {
    if (!activeDeckId) return;
    const labels = labelsInput.split(",").map((s) => s.trim()).filter(Boolean);
    updateDeck(activeDeckId, { labels })
      .then(() => setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? { ...d, labels } : d))))
      .catch((err) => console.error("Failed to save deck labels:", err));
  }

  async function handleAddSearch(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    try {
      const cards = await searchYugiohCards(addQuery.trim());
      setAddResults(cards.slice(0, 8));
    } catch (err) {
      console.error("Deck card search failed:", err);
    }
  }

  async function handleAddCard(card) {
    try {
      await addCardToDeck(activeDeckId, card);
      openDeck(activeDeckId);
      setAddResults([]);
      setAddQuery("");
    } catch (err) {
      console.error("Failed to add card to deck:", err);
    }
  }

  async function handleQuantityChange(cardRow, value) {
    const qty = Math.max(1, Number(value) || 1);
    setDeckCards((prev) => prev.map((c) => (c.id === cardRow.id ? { ...c, quantity: qty } : c)));
    try {
      await updateDeckCardQuantity(cardRow.id, qty);
    } catch (err) {
      console.error("Failed to update deck card quantity:", err);
    }
  }

  async function handleRemoveCard(cardRowId) {
    try {
      await removeCardFromDeck(cardRowId);
      setDeckCards((prev) => prev.filter((c) => c.id !== cardRowId));
    } catch (err) {
      console.error("Failed to remove card from deck:", err);
    }
  }

  const activeDeck = decks.find((d) => d.id === activeDeckId);
  const totalCards = deckCards.reduce((sum, c) => sum + c.quantity, 0);
  const formatLabel = FORMATS.find((f) => f.id === activeDeck?.format)?.label || activeDeck?.format;
  const violationByCardId = new Map(violations.map((v) => [v.yugioh_card_id, v]));

  if (activeDeckId && activeDeck) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={() => setActiveDeckId(null)}>← Back to Decks</button>
          <h1 className="price-page__title">{activeDeck.name}</h1>
          <p className="price-page__subtitle">{formatLabel} — {totalCards} cards</p>
          <label className="auth-form__field" style={{ marginTop: "12px" }}>
            <span>Labels</span>
            <input
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              onBlur={handleLabelsBlur}
              placeholder="Comma separated…"
            />
          </label>
        </div>

        {violations.length > 0 && (
          <p className="panel__status panel__status--error">
            Over the copy limit in {formatLabel}: {violations.map((v) => `${v.card_name} (${v.banStatus}, max ${v.limit})`).join(", ")}
          </p>
        )}

        <form className="price-search" onSubmit={handleAddSearch}>
          <input
            className="price-search__input"
            type="text"
            placeholder="Search a card to add…"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
          />
          <button type="submit" className="price-search__button">Search</button>
        </form>

        {addResults.length > 0 && (
          <ul className="backlog-search-results">
            {addResults.map((card) => (
              <li key={card.id} className="backlog-search-results__row">
                <span>{card.name} ({card.type})</span>
                <button type="button" className="linking-row__connect" onClick={() => handleAddCard(card)}>Add</button>
              </li>
            ))}
          </ul>
        )}

        {deckCardsStatus === "loading" && <p className="panel__status">Loading deck…</p>}
        {deckCardsStatus === "ready" && deckCards.length === 0 && (
          <p className="panel__status">No cards in this deck yet — search above to add some.</p>
        )}
        {deckCardsStatus === "ready" && deckCards.length > 0 && (
          <ul className="backlog-list">
            {deckCards.map((c) => {
              const violation = violationByCardId.get(c.yugioh_card_id);
              return (
                <li key={c.id} className="backlog-card">
                  <div className="backlog-card__info">
                    <span className="backlog-card__title">
                      {c.card_name}
                      {violation && <span className="score-badge score-badge--low"> Over limit</span>}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={c.quantity}
                    onChange={(e) => handleQuantityChange(c, e.target.value)}
                    style={{ width: "48px" }}
                  />
                  <button type="button" className="game-popup__close" onClick={() => handleRemoveCard(c.id)} aria-label="Remove">✕</button>
                </li>
              );
            })}
          </ul>
        )}

        <a href="https://ygoprodeck.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
          Card data and banlist checks via YGOPRODeck
        </a>
      </div>
    );
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Deck Builder</h1>
        <p className="price-page__subtitle">Real per-format banlist checking, powered by YGOPRODeck.</p>
      </div>

      <form className="price-search" onSubmit={handleCreateDeck}>
        <input
          className="price-search__input"
          type="text"
          placeholder="New deck name…"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
        />
        <select value={newDeckFormat} onChange={(e) => setNewDeckFormat(e.target.value)}>
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <button type="submit" className="price-search__button">Create deck</button>
      </form>

      {status === "loading" && <p className="panel__status">Loading your decks…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your decks right now.</p>}
      {status === "ready" && decks.length === 0 && <p className="panel__status">No decks yet — create one above.</p>}

      {status === "ready" && decks.length > 0 && (
        <ul className="backlog-list">
          {decks.map((deck) => (
            <li key={deck.id} className="backlog-card">
              <div className="backlog-card__info">
                <span className="backlog-card__title">{deck.name}</span>
                <span className="backlog-card__meta">{FORMATS.find((f) => f.id === deck.format)?.label || deck.format}</span>
                {deck.labels?.length > 0 && (
                  <div className="label-chip-row">
                    {deck.labels.map((l) => (
                      <span key={l} className="label-chip">{l}</span>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="linking-row__connect" onClick={() => openDeck(deck.id)}>Open</button>
              <button type="button" className="game-popup__close" onClick={() => handleDeleteDeck(deck.id)} aria-label="Delete deck">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
