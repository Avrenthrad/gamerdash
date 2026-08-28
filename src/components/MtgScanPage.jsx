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
//
// Four ways to get a card in, two of them platform-gated (see
// isMobileApp() in lib/platform.js) since each is the wrong fit on the
// other platform — a continuous getUserMedia stream in a phone's own
// scan page vs. a framed preview + manual shutter for a desktop
// webcam:
//   - Live scan (TcgVisualScanner), mobile app only: real-time visual
//     recognition against a pre-built perceptual-hash index — point
//     the camera, no manual capture, no OCR ambiguity to confirm
//     since the match is a direct Scryfall id, not a fuzzy name
//     guess. The other three all feed the same OCR-then-search job
//     pipeline below:
//   - Single photo: <input capture="environment"> — on mobile this
//     opens the real camera app directly; desktop browsers ignore
//     `capture` and just show a normal file picker. Shown on every
//     platform.
//   - Bulk upload: the same input with `multiple` — desktop's real
//     equivalent of scanning a whole binder page at once. Shown on
//     every platform.
//   - Webcam (MtgCardWebcamCapture), desktop/web only: a live preview
//     + manual shutter, for anyone at a desktop with a webcam who'd
//     rather not save photos to disk first.

import { useState } from "react";
import { recognizeCardText, guessNameCandidates } from "../lib/ocr";
import { getCardAutocomplete, getCardByName, getCardById } from "../lib/scryfall";
import { addToCollection } from "../lib/mtg";
import MtgCardWebcamCapture from "./MtgCardWebcamCapture";
import TcgVisualScanner from "./TcgVisualScanner";
import { isMobileApp } from "../lib/platform";

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function MtgScanPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  // One entry per photo, processed independently — a bulk upload of
  // 12 photos means 12 of these, not one shared status.
  const [jobs, setJobs] = useState([]); // [{ id, photo, status, candidates, selectedCard, added, adding }]
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [liveScanOpen, setLiveScanOpen] = useState(false);

  function updateJob(id, patch) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  async function processJob(id, dataUrl) {
    updateJob(id, { status: "reading" });
    try {
      const { lines } = await recognizeCardText(dataUrl);
      const nameGuesses = guessNameCandidates(lines);

      if (nameGuesses.length === 0) {
        updateJob(id, { status: "error" });
        return;
      }

      updateJob(id, { status: "matching" });
      // Try each OCR guess against Scryfall's real autocomplete —
      // collects real card names, not raw unverified OCR text.
      const matchLists = await Promise.all(nameGuesses.map((g) => getCardAutocomplete(g)));
      const uniqueMatches = [...new Set(matchLists.flat())].slice(0, 6);

      if (uniqueMatches.length === 0) {
        updateJob(id, { status: "error" });
        return;
      }

      updateJob(id, { status: "ready", candidates: uniqueMatches });
    } catch (err) {
      console.error("Card scan failed:", err);
      updateJob(id, { status: "error" });
    }
  }

  function addJob(dataUrl) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setJobs((prev) => [
      { id, photo: dataUrl, status: "reading", candidates: [], selectedCard: null, added: false, adding: false },
      ...prev,
    ]);
    processJob(id, dataUrl);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-selecting the same file(s) later
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      addJob(dataUrl);
    }
  }

  function handleWebcamCapture(dataUrl) {
    setWebcamOpen(false);
    addJob(dataUrl);
  }

  // A live-scan match is a direct Scryfall id, not a fuzzy OCR name
  // guess — there's no "which card is this?" ambiguity to resolve, so
  // this job starts (and stays) at "ready" with selectedCard already
  // set, skipping the candidate-list step the other three paths need.
  async function handleVisualMatch(match) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // Starts at "matching" (not "ready") so the brief window before
    // selectedCard resolves shows "Matching against Scryfall…" instead
    // of an empty "Which card is this?" candidate list meant for the
    // OCR path's genuinely ambiguous multi-guess case.
    setJobs((prev) => [
      { id, photo: null, status: "matching", candidates: [], selectedCard: null, added: false, adding: false },
      ...prev,
    ]);
    try {
      const card = await getCardById(match.id);
      updateJob(id, { status: "ready", selectedCard: card, photo: card.imageLarge || card.imageSmall || null });
    } catch (err) {
      console.error("Failed to load matched card:", err);
      updateJob(id, { status: "error" });
    }
  }

  async function handleSelectCandidate(id, name) {
    try {
      const card = await getCardByName(name);
      updateJob(id, { selectedCard: card });
    } catch (err) {
      console.error("Failed to load selected card:", err);
    }
  }

  async function handleAdd(job) {
    if (!job.selectedCard || job.adding || job.added) return;
    updateJob(job.id, { adding: true });
    try {
      await addToCollection(userId, job.selectedCard);
      updateJob(job.id, { added: true, adding: false });
    } catch (err) {
      console.error("Failed to add scanned card:", err);
      updateJob(job.id, { adding: false });
    }
  }

  function handleRemoveJob(id) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Scan a Card</h1>
        <p className="price-page__subtitle">
          Live scan recognizes a card instantly by sight. The other options use free
          on-device text recognition instead — accuracy varies, especially on foils
          or angled photos, so confirm the match below.
        </p>
      </div>

      {!isLoggedIn ? (
        <div className="backlog-add">
          <p className="panel__status">Sign in to add scanned cards to your collection.</p>
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      ) : liveScanOpen ? (
        <TcgVisualScanner
          game="mtg"
          onMatch={(match) => {
            handleVisualMatch(match);
          }}
          onClose={() => setLiveScanOpen(false)}
        />
      ) : webcamOpen ? (
        <MtgCardWebcamCapture onCapture={handleWebcamCapture} onClose={() => setWebcamOpen(false)} />
      ) : (
        <>
          <div className="backlog-add">
            {isMobileApp() && (
              <button type="button" className="settings-avatar__upload" onClick={() => setLiveScanOpen(true)}>
                Live scan
              </button>
            )}
            <label className="settings-avatar__upload">
              Take a photo of a card
              <input type="file" accept="image/*" capture="environment" onChange={handleFiles} hidden />
            </label>
            <label className="settings-avatar__upload">
              Upload multiple photos
              <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
            </label>
            {!isMobileApp() && (
              <button type="button" className="settings-avatar__upload" onClick={() => setWebcamOpen(true)}>
                Use webcam
              </button>
            )}
          </div>

          {jobs.length === 0 && (
            <p className="panel__status">Nothing scanned yet — take a photo, upload a batch, or use your webcam above.</p>
          )}

          {jobs.map((job) => (
            <div key={job.id} className="backlog-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                {job.photo && (
                  <img
                    src={job.photo}
                    alt="Captured card"
                    decoding="async"
                    style={{ width: "100px", borderRadius: "10px", border: "1px solid var(--border)", flexShrink: 0 }}
                  />
                )}
                <div className="backlog-card__info" style={{ flex: 1 }}>
                  {job.status === "reading" && <p className="panel__status">Reading the card…</p>}
                  {job.status === "matching" && <p className="panel__status">Matching against Scryfall…</p>}
                  {job.status === "error" && (
                    <p className="panel__status panel__status--error">
                      Couldn't get a confident read — try again with better lighting, or search by name instead.
                    </p>
                  )}

                  {job.status === "ready" && !job.selectedCard && (
                    <div>
                      <p className="panel__status">Which card is this?</p>
                      <ul className="backlog-search-results">
                        {job.candidates.map((name) => (
                          <li key={name} className="backlog-search-results__row">
                            <span>{name}</span>
                            <button type="button" className="linking-row__connect" onClick={() => handleSelectCandidate(job.id, name)}>
                              This one
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {job.selectedCard && (
                    <div className="surprise-me__result">
                      {job.selectedCard.imageLarge && <img src={job.selectedCard.imageLarge} alt="" decoding="async" style={{ maxWidth: "120px" }} />}
                      <span className="surprise-me__title">{job.selectedCard.name}</span>
                      {job.added ? (
                        <span className="score-badge">Added</span>
                      ) : (
                        <button type="button" className="linking-row__connect" onClick={() => handleAdd(job)} disabled={job.adding}>
                          {job.adding ? "Adding…" : "Add to Collection"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="game-popup__close" onClick={() => handleRemoveJob(job.id)} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        Card data powered by Scryfall
      </a>
    </div>
  );
}
