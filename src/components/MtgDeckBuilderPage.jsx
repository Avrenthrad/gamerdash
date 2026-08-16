// Magic: The Gathering — Deck Builder. Real format-legality checking
// using Scryfall's own per-card legalities data — not a guess.

import { useEffect, useState } from "react";
import { searchCards } from "../lib/scryfall";
import {
  fetchDecks, createDeck, deleteDeck, updateDeck,
  fetchDeckCards, addCardToDeck, updateDeckCardQuantity, removeCardFromDeck,
  checkDeckLegality, uploadCoverImage,
} from "../lib/mtg";

const FORMATS = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander", "brawl", "alchemy"];

export default function MtgDeckBuilderPage({ onBack, userId }) {
  const [decks, setDecks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeDeckId, setActiveDeckId] = useState(null);

  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState("commander");

  const [deckCards, setDeckCards] = useState([]);
  const [illegalCards, setIllegalCards] = useState([]);
  const [deckCardsStatus, setDeckCardsStatus] = useState("idle");

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  const [labelsInput, setLabelsInput] = useState("");
  const [coverStatus, setCoverStatus] = useState("idle");

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
      setActiveDeckId(deck.id);
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

  async function openDeck(deckId) {
    setActiveDeckId(deckId);
    setDeckCardsStatus("loading");
    const deck = decks.find((d) => d.id === deckId);
    setLabelsInput((deck?.labels || []).join(", "));
    try {
      const cards = await fetchDeckCards(deckId);
      setDeckCards(cards);
      const { illegal } = await checkDeckLegality(cards, deck?.format || "commander");
      setIllegalCards(illegal.map((i) => i.card_name));
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

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !userId || !activeDeckId) return;
    setCoverStatus("uploading");
    try {
      const url = await uploadCoverImage(userId, file);
      await updateDeck(activeDeckId, { cover_image_url: url });
      setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? { ...d, cover_image_url: url } : d)));
      setCoverStatus("idle");
    } catch (err) {
      console.error("Failed to upload deck cover photo:", err);
      setCoverStatus("error");
    }
  }

  async function handleAddSearch(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    try {
      const { cards } = await searchCards(addQuery.trim());
      setAddResults(cards.slice(0, 8));
    } catch (err) {
      console.error("Deck card search failed:", err);
    }
  }

  async function handleAddCard(card) {
    try {
      await addCardToDeck(activeDeckId, card);
      openDeck(activeDeckId); // refresh + re-check legality
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

  if (activeDeckId && activeDeck) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={() => setActiveDeckId(null)}>← Back to Decks</button>
          <div className="binder-detail__head">
            <div className="binder-detail__cover">
              {activeDeck.cover_image_url ? (
                <img src={activeDeck.cover_image_url} alt="" />
              ) : (
                <span className="binder-card__cover-fallback" aria-hidden="true">🛠️</span>
              )}
            </div>
            <div className="binder-detail__info">
              <h1 className="price-page__title">{activeDeck.name}</h1>
              <p className="price-page__subtitle" style={{ textTransform: "capitalize" }}>{activeDeck.format} — {totalCards} cards</p>
              <label className="settings-avatar__upload">
                {coverStatus === "uploading" ? "Uploading…" : "Change cover photo"}
                <input type="file" accept="image/*" onChange={handleCoverUpload} hidden />
              </label>
            </div>
          </div>
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

        {illegalCards.length > 0 && (
          <p className="panel__status panel__status--error">
            Not legal in {activeDeck.format}: {illegalCards.join(", ")}
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
                <span>{card.name} ({card.setName})</span>
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
            {deckCards.map((c) => (
              <li key={c.id} className="backlog-card">
                <div className="backlog-card__info">
                  <span className="backlog-card__title">
                    {c.card_name}
                    {illegalCards.includes(c.card_name) && <span className="score-badge score-badge--low"> Not legal</span>}
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
            ))}
          </ul>
        )}

        <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
          Card data and legality checks powered by Scryfall
        </a>
      </div>
    );
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Deck Builder</h1>
        <p className="price-page__subtitle">Real format-legality checking, powered by Scryfall.</p>
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
            <option key={f} value={f} style={{ textTransform: "capitalize" }}>{f}</option>
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
                <span className="backlog-card__meta" style={{ textTransform: "capitalize" }}>{deck.format}</span>
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
