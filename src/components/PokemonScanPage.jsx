// Pokémon — real-time visual card scanner. Same perceptual-hash
// recognition as MtgScanPage's "Live scan" mode (see
// TcgVisualScanner.jsx and scripts/build-tcg-hash-index.mjs) — a
// pokemontcg.io card id is a printing-level id already (confirmed
// live, e.g. "hgss4-1"), so a match resolves directly via
// getPokemonCardById with no card-vs-printing indirection MTG/FAB's
// own adapters need.
//
// Live-scan only for now, unlike MTG's page — no OCR fallback here
// yet (that path needs its own per-game name-recognition tuning, a
// separate scoped effort). "Search instead" always stays one tap away
// if a card isn't in the index yet or doesn't scan cleanly.

import { useState } from "react";
import { getPokemonCardById } from "../lib/pokemon";
import { addToCollection } from "../lib/pokemonCollection";
import TcgVisualScanner from "./TcgVisualScanner";

export default function PokemonScanPage({ onBack, onGoToSearch, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [status, setStatus] = useState("scanning"); // scanning | loading-card | ready | error
  const [card, setCard] = useState(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleMatch(match) {
    setStatus("loading-card");
    try {
      const resolved = await getPokemonCardById(match.id);
      if (!resolved) {
        setStatus("error");
        return;
      }
      setCard(resolved);
      setAdded(false);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load matched card:", err);
      setStatus("error");
    }
  }

  async function handleAdd() {
    if (!card || adding || added) return;
    setAdding(true);
    try {
      await addToCollection(userId, card);
      setAdded(true);
    } catch (err) {
      console.error("Failed to add scanned card:", err);
    } finally {
      setAdding(false);
    }
  }

  function handleScanAnother() {
    setCard(null);
    setAdded(false);
    setStatus("scanning");
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Scan a Card</h1>
        <p className="price-page__subtitle">
          Real-time visual recognition — point your camera at a card, no manual capture needed.
        </p>
      </div>

      {!isLoggedIn ? (
        <div className="backlog-add">
          <p className="panel__status">Sign in to add scanned cards to your collection.</p>
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      ) : (
        <>
          {(status === "scanning" || status === "loading-card") && (
            <TcgVisualScanner game="pokemon" onMatch={handleMatch} onClose={onBack} />
          )}
          {status === "loading-card" && <p className="panel__status">Loading card details…</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">Couldn't load that match — try again.</p>
          )}

          {status === "ready" && card && (
            <div className="surprise-me__result">
              {card.imageLarge && <img src={card.imageLarge} alt="" style={{ maxWidth: "220px" }} />}
              <span className="surprise-me__title">{card.name}</span>
              {added ? (
                <span className="score-badge">Added</span>
              ) : (
                <button type="button" className="linking-row__connect" onClick={handleAdd} disabled={adding}>
                  {adding ? "Adding…" : "Add to Collection"}
                </button>
              )}
              <button type="button" className="quickdash-reset-btn" onClick={handleScanAnother}>
                Scan another
              </button>
            </div>
          )}

          <p className="panel__status" style={{ marginTop: "12px" }}>
            Can't find your card? <button type="button" className="linkish" onClick={onGoToSearch}>Search by name instead</button>
          </p>
        </>
      )}
    </div>
  );
}
