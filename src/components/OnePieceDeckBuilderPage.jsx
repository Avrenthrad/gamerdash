// One Piece Card Game — Deck Builder. Every real constructed deck is
// built around exactly one Leader card, same spirit as Flesh and
// Blood's Hero anchor — unlike FabDeckBuilderPage though, the Leader
// is picked/changed from inside the deck (leader_card_id is nullable
// at the DB level so a deck can exist before one's chosen), not a
// gate before deck creation. No format/banlist checking — no
// confirmed banlist API for this game, so cards just get added freely.

import { useEffect, useState } from "react";
import { searchOnePieceCards } from "../lib/onepiece";
import {
  fetchDecks, createDeck, deleteDeck, updateDeck, setDeckLeader,
  fetchDeckCards, addCardToDeck, updateDeckCardQuantity, removeCardFromDeck,
} from "../lib/onepieceCollection";

export default function OnePieceDeckBuilderPage({ onBack, userId }) {
  const [decks, setDecks] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeDeckId, setActiveDeckId] = useState(null);

  const [newDeckName, setNewDeckName] = useState("");

  const [deckCards, setDeckCards] = useState([]);
  const [deckCardsStatus, setDeckCardsStatus] = useState("idle");

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  const [leaderQuery, setLeaderQuery] = useState("");
  const [leaderResults, setLeaderResults] = useState([]);

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
      const deck = await createDeck(userId, newDeckName.trim());
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

  async function handleLeaderSearch(e) {
    e.preventDefault();
    if (!leaderQuery.trim()) return;
    try {
      const cards = await searchOnePieceCards(leaderQuery.trim());
      setLeaderResults(cards.filter((c) => c.type === "Leader").slice(0, 8));
    } catch (err) {
      console.error("Leader search failed:", err);
    }
  }

  async function handleSetLeader(card) {
    try {
      await setDeckLeader(activeDeckId, card);
      setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? { ...d, leader_card_id: card.id, leader_card_name: card.name } : d)));
      setLeaderResults([]);
      setLeaderQuery("");
    } catch (err) {
      console.error("Failed to set deck Leader:", err);
    }
  }

  async function handleAddSearch(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    try {
      const cards = await searchOnePieceCards(addQuery.trim());
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

  if (activeDeckId && activeDeck) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={() => setActiveDeckId(null)}>← Back to Decks</button>
          <h1 className="price-page__title">{activeDeck.name}</h1>
          <p className="price-page__subtitle">
            Leader: {activeDeck.leader_card_name || "not set"} — {totalCards} cards
          </p>
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

        <form className="price-search" onSubmit={handleLeaderSearch}>
          <input
            className="price-search__input"
            type="text"
            placeholder={activeDeck.leader_card_name ? "Search to change your Leader…" : "Search for your Leader…"}
            value={leaderQuery}
            onChange={(e) => setLeaderQuery(e.target.value)}
          />
          <button type="submit" className="price-search__button">Search</button>
        </form>
        {leaderResults.length > 0 && (
          <ul className="backlog-search-results">
            {leaderResults.map((card) => (
              <li key={card.id} className="backlog-search-results__row">
                <span>{card.name} ({card.color})</span>
                <button type="button" className="linking-row__connect" onClick={() => handleSetLeader(card)}>Choose</button>
              </li>
            ))}
          </ul>
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
            {deckCards.map((c) => (
              <li key={c.id} className="backlog-card">
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{c.card_name}</span>
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

        <a href="https://optcgapi.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
          Card data via optcgapi.com
        </a>
      </div>
    );
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Deck Builder</h1>
        <p className="price-page__subtitle">Every real One Piece deck is built around one Leader — pick yours after creating a deck.</p>
      </div>

      <form className="price-search" onSubmit={handleCreateDeck}>
        <input
          className="price-search__input"
          type="text"
          placeholder="New deck name…"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
        />
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
                <span className="backlog-card__meta">{deck.leader_card_name || "No Leader yet"}</span>
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
