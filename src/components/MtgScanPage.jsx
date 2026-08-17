// Magic: The Gathering — Card Scanner.
//
// Free OCR-based scanning (Tesseract.js, runs entirely in-browser, no
// API key needed) rather than a paid image-recognition service —
// genuinely useful, but honest about its real limits: OCR sometimes
// misreads a character or two on MTG's card-name font (confirmed from
// a real open-source project that tried the same free approach and
// hit the same issue), especially on foils or angled photos. That's
// why this shows a few candidate matches to confirm rather than
// silently trusting the first guess and adding it straight to your
// collection — a wrong silent add would be worse than asking.

import { useState } from "react";
import { recognizeCardText, guessNameCandidates } from "../lib/ocr";
import { getCardAutocomplete, getCardByName } from "../lib/scryfall";
import { addToCollection } from "../lib/mtg";

export default function MtgScanPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | reading | matching | ready | error
  const [candidates, setCandidates] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [added, setAdded] = useState(false);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    setPhoto(dataUrl);
    setSelectedCard(null);
    setAdded(false);
    setStatus("reading");

    try {
      const { lines } = await recognizeCardText(dataUrl);
      const nameGuesses = guessNameCandidates(lines);

      if (nameGuesses.length === 0) {
        setStatus("error");
        return;
      }

      setStatus("matching");
      // Try each OCR guess against Scryfall's real autocomplete —
      // collects real card names, not raw unverified OCR text.
      const matchLists = await Promise.all(nameGuesses.map((g) => getCardAutocomplete(g)));
      const uniqueMatches = [...new Set(matchLists.flat())].slice(0, 6);

      if (uniqueMatches.length === 0) {
        setStatus("error");
        return;
      }

      setCandidates(uniqueMatches);
      setStatus("ready");
    } catch (err) {
      console.error("Card scan failed:", err);
      setStatus("error");
    }
  }

  async function handleSelectCandidate(name) {
    try {
      const card = await getCardByName(name);
      setSelectedCard(card);
    } catch (err) {
      console.error("Failed to load selected card:", err);
    }
  }

  async function handleAdd() {
    if (!selectedCard) return;
    try {
      await addToCollection(userId, selectedCard);
      setAdded(true);
    } catch (err) {
      console.error("Failed to add scanned card:", err);
    }
  }

  function handleScanAnother() {
    setPhoto(null);
    setCandidates([]);
    setSelectedCard(null);
    setAdded(false);
    setStatus("idle");
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Scan a Card</h1>
        <p className="price-page__subtitle">
          Free, on-device text recognition — matches against real Scryfall data.
          Accuracy varies, especially on foils or angled photos, so confirm the match below.
        </p>
      </div>

      {!isLoggedIn ? (
        <div className="backlog-add">
          <p className="panel__status">Sign in to add scanned cards to your collection.</p>
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      ) : (
        <div className="backlog-add">
          <label className="settings-avatar__upload">
            {photo ? "Take another photo" : "Take a photo of a card"}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} hidden />
          </label>

          {photo && (
            <img
              src={photo}
              alt="Captured card"
              style={{ width: "160px", borderRadius: "10px", border: "1px solid var(--border)" }}
            />
          )}

          {status === "reading" && <p className="panel__status">Reading the card…</p>}
          {status === "matching" && <p className="panel__status">Matching against Scryfall…</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">
              Couldn't get a confident read — try again with better lighting, or search by name instead.
            </p>
          )}

          {status === "ready" && !selectedCard && (
            <div>
              <p className="panel__status">Which card is this?</p>
              <ul className="backlog-search-results">
                {candidates.map((name) => (
                  <li key={name} className="backlog-search-results__row">
                    <span>{name}</span>
                    <button type="button" className="linking-row__connect" onClick={() => handleSelectCandidate(name)}>
                      This one
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedCard && (
            <div className="surprise-me__result">
              {selectedCard.imageLarge && <img src={selectedCard.imageLarge} alt="" />}
              <span className="surprise-me__title">{selectedCard.name}</span>
              {added ? (
                <span className="score-badge">Added</span>
              ) : (
                <button type="button" className="linking-row__connect" onClick={handleAdd}>
                  Add to Collection
                </button>
              )}
              <button type="button" className="quickdash-reset-btn" onClick={handleScanAnother}>
                Scan another
              </button>
            </div>
          )}
        </div>
      )}

      <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        Card data powered by Scryfall
      </a>
    </div>
  );
}
