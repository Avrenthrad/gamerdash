// Shared Binders & Set Lists UI for MTG, Flesh and Blood, and Pokémon
// — the three games' binder pages were near-identical copies of each
// other (same table shape per game: *_binders/*_binder_cards, split by
// `kind`). The real per-game differences (card identity fields, which
// search API to call, whether Set Lists are even supported, foil/
// condition controls) are isolated into a per-game `adapter` object —
// see MtgBindersPage.jsx / FabBindersPage.jsx / PokemonBindersPage.jsx
// for the three adapters. This file has no game-specific knowledge at
// all; if a 4th TCG is ever added, it needs only a new adapter, not a
// new copy of this component.

import { useEffect, useMemo, useState } from "react";

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

export default function BindersPage({ userId, kind, adapter }) {
  const isSetList = kind === "set_list";
  const [binders, setBinders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeBinderId, setActiveBinderId] = useState(null);

  const [newName, setNewName] = useState("");
  const [newLabels, setNewLabels] = useState("");
  const [allSets, setAllSets] = useState([]);
  const [setQuery, setSetQuery] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, kind]);

  async function load() {
    setStatus("loading");
    try {
      const rows = await adapter.lib.fetchBinders(userId, kind);
      setBinders(rows);
      setStatus("ready");
    } catch (err) {
      console.error(`Failed to load ${kind}s:`, err);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!isSetList || !adapter.setLists) return;
    adapter.setLists
      .fetchAllSets()
      .then(setAllSets)
      .catch((err) => console.error("Failed to load the real set list:", err));
  }, [isSetList, adapter.setLists]);

  const setMatches = useMemo(() => {
    if (!adapter.setLists) return [];
    const q = setQuery.trim().toLowerCase();
    if (!q) return [];
    const existingKeys = adapter.setLists.existingSetKeys(binders);
    return allSets
      .filter((s) => !existingKeys.has(adapter.setLists.setKey(s)) && adapter.setLists.matches(s, q))
      .slice(0, 8);
  }, [setQuery, allSets, binders, adapter.setLists]);

  async function handleCreateBinder(e) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const labels = newLabels.split(",").map((s) => s.trim()).filter(Boolean);
      const binder = await adapter.lib.createBinder(userId, { name: newName.trim(), labels });
      setBinders((prev) => [binder, ...prev]);
      setNewName("");
      setNewLabels("");
    } catch (err) {
      console.error("Failed to create binder:", err);
    }
    setCreating(false);
  }

  async function handleCreateSetList(set) {
    if (creating) return;
    setCreating(true);
    try {
      const binder = await adapter.setLists.create(userId, set);
      setBinders((prev) => [binder, ...prev]);
      setSetQuery("");
      setActiveBinderId(binder.id);
    } catch (err) {
      console.error("Failed to create set list:", err);
    }
    setCreating(false);
  }

  async function handleDelete(binderId) {
    try {
      await adapter.lib.deleteBinder(binderId);
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
        adapter={adapter}
        onBack={() => setActiveBinderId(null)}
        onUpdated={(patch) =>
          setBinders((prev) => prev.map((b) => (b.id === activeBinder.id ? { ...b, ...patch } : b)))
        }
      />
    );
  }

  return (
    <div>
      {isSetList ? (
        <div className="backlog-add">
          <input
            className="price-search__input"
            type="text"
            placeholder={adapter.setLists.searchPlaceholder}
            value={setQuery}
            onChange={(e) => setSetQuery(e.target.value)}
          />
          {setMatches.length > 0 && (
            <ul className="backlog-search-results">
              {setMatches.map((s) => (
                <li key={adapter.setLists.setKey(s)} className="backlog-search-results__row">
                  <span>{adapter.setLists.resultLabel(s)}</span>
                  <button type="button" className="linking-row__connect" disabled={creating} onClick={() => handleCreateSetList(s)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
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
      )}

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your {isSetList ? "set lists" : "binders"} right now.</p>}

      {status === "ready" && binders.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">{isSetList ? "🗂️" : "📁"}</span>
          <p className="empty-state__body">
            {isSetList
              ? adapter.setLists.emptyStateText
              : "No binders yet — create one above to start grouping your cards."}
          </p>
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
                    <span className="binder-card__cover-fallback" aria-hidden="true">{isSetList ? "🗂️" : "📁"}</span>
                  )}
                  {isSetList && adapter.setLists.binderSetIconUrl(b) && (
                    <img src={adapter.setLists.binderSetIconUrl(b)} alt="" className="binder-card__set-icon" />
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

function BinderDetail({ binder, userId, onBack, onUpdated, adapter }) {
  const isSetList = binder.kind === "set_list";
  const [binderCards, setBinderCards] = useState([]);
  const [status, setStatus] = useState("loading");
  const [setCards, setSetCards] = useState([]);
  const [setCardsStatus, setSetCardsStatus] = useState(isSetList ? "loading" : "idle");
  const [labelsInput, setLabelsInput] = useState((binder.labels || []).join(", "));
  const [coverStatus, setCoverStatus] = useState("idle");
  const [checklistQuery, setChecklistQuery] = useState("");

  useEffect(() => {
    loadBinderCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder.id]);

  async function loadBinderCards() {
    setStatus("loading");
    try {
      const rows = await adapter.lib.fetchBinderCards(binder.id);
      setBinderCards(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load binder cards:", err);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!isSetList) return;
    setSetCardsStatus("loading");
    adapter.setLists
      .fetchChecklist(binder)
      .then((cards) => {
        setSetCards(cards);
        setSetCardsStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load set checklist:", err);
        setSetCardsStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetList, binder.id]);

  const ownedMap = useMemo(() => {
    if (!isSetList) return {};
    const map = {};
    binderCards.forEach((bc) => {
      map[adapter.setLists.binderCardKeyField(bc)] = bc;
    });
    return map;
  }, [binderCards, isSetList, adapter.setLists]);

  async function handleChecklistQuantity(card, quantity, extra) {
    try {
      const row = await adapter.setLists.checklistSetQuantity(binder.id, card, quantity, extra);
      setBinderCards((prev) => {
        const others = prev.filter((bc) => adapter.setLists.binderCardKeyField(bc) !== card.id);
        return row ? [...others, row] : others;
      });
    } catch (err) {
      console.error("Failed to update binder card:", err);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setCoverStatus("uploading");
    try {
      const url = await adapter.lib.uploadCoverImage(userId, file);
      await adapter.lib.updateBinder(binder.id, { cover_image_url: url });
      onUpdated({ cover_image_url: url });
      setCoverStatus("idle");
    } catch (err) {
      console.error("Failed to upload cover photo:", err);
      setCoverStatus("error");
    }
  }

  function handleLabelsBlur() {
    const labels = labelsInput.split(",").map((s) => s.trim()).filter(Boolean);
    adapter.lib
      .updateBinder(binder.id, { labels })
      .then(() => onUpdated({ labels }))
      .catch((err) => console.error("Failed to save labels:", err));
  }

  const totalQty = binderCards.reduce((sum, bc) => sum + bc.quantity, 0);
  const ownedCount = binderCards.filter((bc) => bc.quantity > 0).length;

  // Client-side filter over the already-loaded set checklist — no
  // extra API calls, just narrowing what's already on screen. Matches
  // by name or collector number ("#1", "1") so either works.
  const visibleSetCards = useMemo(() => {
    if (!isSetList) return [];
    const q = checklistQuery.trim().toLowerCase();
    if (!q) return setCards;
    const qNumber = q.replace(/^#/, "");
    return setCards.filter((card) => adapter.setLists.checklistMatchesQuery(card, q, qNumber));
  }, [setCards, checklistQuery, isSetList, adapter.setLists]);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <div className="binder-detail__head">
          <div className="binder-detail__cover">
            {binder.cover_image_url ? (
              <img src={binder.cover_image_url} alt="" />
            ) : (
              <span className="binder-card__cover-fallback" aria-hidden="true">{isSetList ? "🗂️" : "📁"}</span>
            )}
          </div>
          <div className="binder-detail__info">
            <h1 className="price-page__title">
              {isSetList && adapter.setLists.binderSetIconUrl(binder) && (
                <img src={adapter.setLists.binderSetIconUrl(binder)} alt="" className="binder-detail__set-icon" />
              )}
              {binder.name}
            </h1>
            <p className="price-page__subtitle">
              {isSetList
                ? `${ownedCount} / ${setCardsStatus === "ready" ? setCards.length : "…"} cards owned`
                : `${binderCards.length} unique cards · ${totalQty} total`}
            </p>
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

      {isSetList ? (
        <>
          {setCardsStatus === "loading" && <p className="panel__status">Loading this set's real card list…</p>}
          {setCardsStatus === "error" && <p className="panel__status panel__status--error">{adapter.setLists.checklistErrorText || "Couldn't load this set's checklist right now."}</p>}
          {setCardsStatus === "ready" && setCards.length === 0 && (
            <p className="panel__status">{adapter.setLists.checklistEmptyText || "No cards found for this set right now."}</p>
          )}

          {setCardsStatus === "ready" && setCards.length > 0 && (
            <>
              <div className="checklist-search">
                <input
                  className="price-search__input"
                  type="text"
                  placeholder={`Search ${setCards.length} cards by name or #number…`}
                  value={checklistQuery}
                  onChange={(e) => setChecklistQuery(e.target.value)}
                />
                {checklistQuery.trim() && (
                  <button type="button" className="checklist-search__clear" onClick={() => setChecklistQuery("")} aria-label="Clear search">
                    ✕
                  </button>
                )}
              </div>
              {checklistQuery.trim() && (
                <p className="panel__status">
                  {visibleSetCards.length} match{visibleSetCards.length === 1 ? "" : "es"} for "{checklistQuery}"
                </p>
              )}
            </>
          )}

          {setCardsStatus === "ready" && visibleSetCards.length > 0 && (
            <ul className="backlog-list">
              {visibleSetCards.map((card) => {
                const owned = ownedMap[card.id];
                const qty = owned?.quantity || 0;
                return (
                  <li key={card.id} className={`backlog-card ${qty > 0 ? "backlog-card--owned" : ""}`}>
                    {card.imageSmall ? (
                      <img src={card.imageSmall} alt="" className="backlog-card__thumb" style={{ width: "56px", height: "78px" }} />
                    ) : (
                      <div className="backlog-card__thumb backlog-card__thumb--placeholder" style={{ width: "56px", height: "78px" }} />
                    )}
                    <div className="backlog-card__info">
                      <span className="backlog-card__title">
                        {card.collectorNumber ? `#${card.collectorNumber} ` : ""}{card.name}
                      </span>
                      <span className="backlog-card__meta">{card.rarity}</span>
                    </div>
                    <div className="backlog-card__actions">
                      <div className="qty-stepper">
                        {qty > 0 && (
                          <button
                            type="button"
                            className="qty-stepper__btn"
                            aria-label={`Remove one ${card.name}`}
                            onClick={() => handleChecklistQuantity(card, qty - 1, { foil: owned?.foil || false, condition: owned?.condition })}
                          >
                            −
                          </button>
                        )}
                        {qty > 0 && <span className="qty-stepper__count">{qty}</span>}
                        <button
                          type="button"
                          className="qty-stepper__btn qty-stepper__btn--add"
                          aria-label={`Add one ${card.name}`}
                          onClick={() => handleChecklistQuantity(card, qty + 1, { foil: owned?.foil || false, condition: owned?.condition || "Near Mint" })}
                        >
                          +
                        </button>
                      </div>

                      {adapter.setLists.supportsFoil && (
                        <button
                          type="button"
                          className="foil-toggle"
                          role="switch"
                          aria-checked={!!owned?.foil}
                          aria-label={`${card.name} is foil`}
                          onClick={() => handleChecklistQuantity(card, qty || 1, { foil: !owned?.foil, condition: owned?.condition || "Near Mint" })}
                        >
                          <span className="foil-toggle__track">
                            <span className="foil-toggle__thumb" />
                          </span>
                          <span className="foil-toggle__label">Foil</span>
                        </button>
                      )}

                      {adapter.setLists.supportsCondition && qty > 0 && (
                        <select
                          className="condition-select"
                          value={owned?.condition || "Near Mint"}
                          onChange={(e) => handleChecklistQuantity(card, qty, { foil: owned?.foil || false, condition: e.target.value })}
                          aria-label={`Condition for ${card.name}`}
                        >
                          {adapter.setLists.cardConditions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <BinderCardsEditor binderId={binder.id} binderCards={binderCards} status={status} onChange={setBinderCards} adapter={adapter} />
      )}

      <a href={adapter.attributionHref} target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        {adapter.attributionText(isSetList)}
      </a>
    </div>
  );
}

function BinderCardsEditor({ binderId, binderCards, status, onChange, adapter }) {
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!addQuery.trim()) return;
    try {
      const cards = await adapter.editor.searchCards(addQuery.trim());
      setAddResults(cards.slice(0, 8));
    } catch (err) {
      console.error("Binder card search failed:", err);
    }
  }

  async function handleAdd(card) {
    try {
      const existing = adapter.editor.findExisting(binderCards, card);
      const row = await adapter.lib.setBinderCardQuantity(
        binderId,
        card,
        (existing?.quantity || 0) + 1,
        adapter.editor.addOptions(card, existing)
      );
      onChange((prev) => {
        const others = prev.filter((bc) => !adapter.editor.isSameCard(bc, card));
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
      const row = await adapter.lib.setBinderCardQuantity(
        binderId,
        adapter.editor.quantityChangeCard(bc),
        qty,
        adapter.editor.quantityChangeOptions(bc)
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
      await adapter.lib.removeBinderCard(bc.id);
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
              <span>{card.name} ({adapter.editor.cardSubtitle(card)})</span>
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
                <span className="backlog-card__meta">{adapter.editor.rowMeta(bc)}</span>
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
