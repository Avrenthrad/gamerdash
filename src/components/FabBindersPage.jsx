// Flesh and Blood — Binders. A user-named group of cards with labels
// + a cover photo, same real pattern as MtgBindersPage.jsx's "binder"
// kind (mtg_binders/fab_binders share the same shape).
//
// NOT built: Set Lists (MTG's other binder kind, pinned to one real
// set as an owned-quantity checklist). goagain.dev's `set` search
// filter was tested live and does NOT actually scope results —
// `type=Hero` correctly narrows 4897 cards to 150, but `set=WTR`
// (Welcome to Rathe, a small starter-level set) returns 862 results
// with duplicate entries, clearly broken or ignored server-side. Per
// this project's rule to never build on an unverified/non-functional
// capability, Set Lists for FaB are on hold until either goagain fixes
// this or a working real alternative is found — flagged here rather
// than shipped broken or silently dropped.

import { useEffect, useState } from "react";
import {
  fetchBinders, createBinder, updateBinder, deleteBinder,
  fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage,
} from "../lib/fabCollection";
import { searchFabCards } from "../lib/fab";

function LabelChips({ labels }) {
  if (!labels || labels.length === 0) return null;
  return (
    <div className="label-chip-row">
      {labels.map((l) => (
        <span key={l} className="label-chip">{l}</span>
      ))}
    </div>
  );
}

export default function FabBindersPage({ userId }) {
  const [binders, setBinders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeBinderId, setActiveBinderId] = useState(null);

  const [newName, setNewName] = useState("");
  const [newLabels, setNewLabels] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    setStatus("loading");
    try {
      const rows = await fetchBinders(userId, "binder");
      setBinders(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load binders:", err);
      setStatus("error");
    }
  }

  async function handleCreateBinder(e) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const labels = newLabels.split(",").map((s) => s.trim()).filter(Boolean);
      const binder = await createBinder(userId, { name: newName.trim(), labels });
      setBinders((prev) => [binder, ...prev]);
      setNewName("");
      setNewLabels("");
    } catch (err) {
      console.error("Failed to create binder:", err);
    }
    setCreating(false);
  }

  async function handleDelete(binderId) {
    try {
      await deleteBinder(binderId);
      setBinders((prev) => prev.filter((b) => b.id !== binderId));
      if (activeBinderId === binderId) setActiveBinderId(null);
    } catch (err) {
      console.error("Failed to delete binder:", err);
    }
  }

  const activeBinder = binders.find((b) => b.id === activeBinderId);

  if (activeBinder) {
    return (
      <BinderDetail
        binder={activeBinder}
        userId={userId}
        onBack={() => setActiveBinderId(null)}
        onUpdated={(patch) =>
          setBinders((prev) => prev.map((b) => (b.id === activeBinder.id ? { ...b, ...patch } : b)))
        }
      />
    );
  }

  return (
    <div>
      <form className="backlog-add" onSubmit={handleCreateBinder}>
        <input
          className="price-search__input"
          type="text"
          placeholder="New binder name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="price-search__input"
          type="text"
          placeholder="Labels, comma separated (optional)"
          value={newLabels}
          onChange={(e) => setNewLabels(e.target.value)}
        />
        <button type="submit" className="price-search__button" disabled={creating}>
          + New binder
        </button>
      </form>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your binders right now.</p>}

      {status === "ready" && binders.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">📁</span>
          <p className="empty-state__body">No binders yet — create one above to start grouping your cards.</p>
        </div>
      )}

      {binders.length > 0 && (
        <div className="binder-grid">
          {binders.map((b) => (
            <div key={b.id} className="binder-card">
              <button type="button" className="binder-card__open" onClick={() => setActiveBinderId(b.id)}>
                <span className="binder-card__cover">
                  {b.cover_image_url ? (
                    <img src={b.cover_image_url} alt="" />
                  ) : (
                    <span className="binder-card__cover-fallback" aria-hidden="true">📁</span>
                  )}
                </span>
                <span className="binder-card__name">{b.name}</span>
                <LabelChips labels={b.labels} />
              </button>
              <button type="button" className="game-popup__close binder-card__delete" onClick={() => handleDelete(b.id)} aria-label={`Delete ${b.name}`}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BinderDetail({ binder, userId, onBack, onUpdated }) {
  const [binderCards, setBinderCards] = useState([]);
  const [status, setStatus] = useState("loading");
  const [labelsInput, setLabelsInput] = useState((binder.labels || []).join(", "));
  const [coverStatus, setCoverStatus] = useState("idle");

  useEffect(() => {
    loadBinderCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder.id]);

  async function loadBinderCards() {
    setStatus("loading");
    try {
      const rows = await fetchBinderCards(binder.id);
      setBinderCards(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load binder cards:", err);
      setStatus("error");
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setCoverStatus("uploading");
    try {
      const url = await uploadCoverImage(userId, file);
      await updateBinder(binder.id, { cover_image_url: url });
      onUpdated({ cover_image_url: url });
      setCoverStatus("idle");
    } catch (err) {
      console.error("Failed to upload cover photo:", err);
      setCoverStatus("error");
    }
  }

  function handleLabelsBlur() {
    const labels = labelsInput.split(",").map((s) => s.trim()).filter(Boolean);
    updateBinder(binder.id, { labels })
      .then(() => onUpdated({ labels }))
      .catch((err) => console.error("Failed to save labels:", err));
  }

  const totalQty = binderCards.reduce((sum, bc) => sum + bc.quantity, 0);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <div className="binder-detail__head">
          <div className="binder-detail__cover">
            {binder.cover_image_url ? (
              <img src={binder.cover_image_url} alt="" />
            ) : (
              <span className="binder-card__cover-fallback" aria-hidden="true">📁</span>
            )}
          </div>
          <div className="binder-detail__info">
            <h1 className="price-page__title">{binder.name}</h1>
            <p className="price-page__subtitle">{binderCards.length} unique cards · {totalQty} total</p>
            <label className="settings-avatar__upload">
              {coverStatus === "uploading" ? "Uploading…" : "Change cover photo"}
              <input type="file" accept="image/*" onChange={handleCoverUpload} hidden />
            </label>
          </div>
        </div>
      </div>

      <label className="auth-form__field">
        <span>Labels</span>
        <input
          value={labelsInput}
          onChange={(e) => setLabelsInput(e.target.value)}
          onBlur={handleLabelsBlur}
          placeholder="Comma separated…"
        />
      </label>

      <BinderCardsEditor binderId={binder.id} binderCards={binderCards} status={status} onChange={setBinderCards} />

      <a href="https://fabtcg.com" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        Card data via goagain.dev · Flesh and Blood is a trademark of Legend Story Studios
      </a>
    </div>
  );
}

function BinderCardsEditor({ binderId, binderCards, status, onChange }) {
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    try {
      const { cards } = await searchFabCards({ name: addQuery.trim() });
      setAddResults(cards.slice(0, 8));
    } catch (err) {
      console.error("Binder card search failed:", err);
    }
  }

  async function handleAdd(card) {
    const printing = card.printings[0];
    try {
      const existing = binderCards.find((bc) => bc.fab_card_id === card.id && bc.printing_unique_id === printing?.printingId);
      const row = await setBinderCardQuantity(binderId, card, (existing?.quantity || 0) + 1, {
        printingUniqueId: printing?.printingId || null,
        setId: printing?.setId || null,
        edition: printing?.edition || null,
        foiling: printing?.foiling || null,
        foil: existing?.foil || false,
      });
      onChange((prev) => {
        const others = prev.filter((bc) => !(bc.fab_card_id === card.id && bc.printing_unique_id === printing?.printingId));
        return row ? [...others, row] : others;
      });
      setAddResults([]);
      setAddQuery("");
    } catch (err) {
      console.error("Failed to add card to binder:", err);
    }
  }

  async function handleQuantityChange(bc, value) {
    const qty = Math.max(0, Number(value) || 0);
    try {
      const row = await setBinderCardQuantity(
        binderId,
        { id: bc.fab_card_id, name: bc.card_name },
        qty,
        { printingUniqueId: bc.printing_unique_id, setId: bc.set_id, edition: bc.edition, foiling: bc.foiling }
      );
      onChange((prev) => {
        const others = prev.filter((x) => x.id !== bc.id);
        return row ? [...others, row] : others;
      });
    } catch (err) {
      console.error("Failed to update binder card quantity:", err);
    }
  }

  async function handleRemove(bc) {
    try {
      await removeBinderCard(bc.id);
      onChange((prev) => prev.filter((x) => x.id !== bc.id));
    } catch (err) {
      console.error("Failed to remove binder card:", err);
    }
  }

  return (
    <>
      <form className="price-search" onSubmit={handleSearch}>
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
              <span>{card.name} ({card.typeText})</span>
              <button type="button" className="linking-row__connect" onClick={() => handleAdd(card)}>Add</button>
            </li>
          ))}
        </ul>
      )}

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "ready" && binderCards.length === 0 && (
        <p className="panel__status">No cards in this binder yet — search above to add some.</p>
      )}

      {binderCards.length > 0 && (
        <ul className="backlog-list">
          {binderCards.map((bc) => (
            <li key={bc.id} className="backlog-card">
              <div className="backlog-card__info">
                <span className="backlog-card__title">{bc.card_name}</span>
                <span className="backlog-card__meta">
                  {bc.set_id && <span>{bc.set_id}</span>}
                  {bc.foiling && <span>{bc.foiling}</span>}
                </span>
              </div>
              <label className="backlog-card__hours">
                Qty:
                <input
                  type="number"
                  min="0"
                  value={bc.quantity}
                  onChange={(e) => handleQuantityChange(bc, e.target.value)}
                  style={{ width: "48px" }}
                />
              </label>
              <button type="button" className="game-popup__close" onClick={() => handleRemove(bc)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
