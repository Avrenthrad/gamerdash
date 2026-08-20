// Pokémon TCG — My Collection — Binders & Set Lists. Same underlying
// table (pokemon_binders), split by `kind`, same shape as
// MtgBindersPage.jsx. Unlike FabBindersPage.jsx, Set Lists ARE built
// here — pokemontcg.io's set.id filter was confirmed live to scope
// correctly (matched a set's own real total card count).

import { useEffect, useMemo, useState } from "react";
import {
  fetchBinders, createBinder, createSetList, updateBinder, deleteBinder,
  fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage,
} from "../lib/pokemonCollection";
import { searchPokemonCards, getAllPokemonSets, getPokemonSetCards, nameQuery } from "../lib/pokemon";

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

export default function PokemonBindersPage({ userId, kind }) {
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
      const rows = await fetchBinders(userId, kind);
      setBinders(rows);
      setStatus("ready");
    } catch (err) {
      console.error(`Failed to load ${kind}s:`, err);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!isSetList) return;
    getAllPokemonSets()
      .then(setAllSets)
      .catch((err) => console.error("Failed to load Pokémon set list:", err));
  }, [isSetList]);

  const setMatches = useMemo(() => {
    const q = setQuery.trim().toLowerCase();
    if (!q) return [];
    const existingIds = new Set(binders.map((b) => b.pokemon_set_id));
    return allSets
      .filter((s) => !existingIds.has(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [setQuery, allSets, binders]);

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

  async function handleCreateSetList(set) {
    if (creating) return;
    setCreating(true);
    try {
      const binder = await createSetList(userId, set.id);
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
      {isSetList ? (
        <div className="backlog-add">
          <input
            className="price-search__input"
            type="text"
            placeholder="Search a real Pokémon set (e.g. Scarlet & Violet)…"
            value={setQuery}
            onChange={(e) => setSetQuery(e.target.value)}
          />
          {setMatches.length > 0 && (
            <ul className="backlog-search-results">
              {setMatches.map((s) => (
                <li key={s.id} className="backlog-search-results__row">
                  <span>{s.name} — {s.total} cards</span>
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
              ? "No set lists yet — search a real Pokémon set above to start a checklist."
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
      const rows = await fetchBinderCards(binder.id);
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
    getPokemonSetCards(binder.pokemon_set_id)
      .then((cards) => {
        setSetCards(cards);
        setSetCardsStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load set checklist:", err);
        setSetCardsStatus("error");
      });
  }, [isSetList, binder.pokemon_set_id]);

  const ownedMap = useMemo(() => {
    const map = {};
    binderCards.forEach((bc) => {
      map[bc.pokemon_card_id] = bc;
    });
    return map;
  }, [binderCards]);

  async function handleChecklistQuantity(card, quantity, condition) {
    try {
      const row = await setBinderCardQuantity(binder.id, card, quantity, { condition });
      setBinderCards((prev) => {
        const others = prev.filter((bc) => bc.pokemon_card_id !== card.id);
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
  const ownedCount = binderCards.filter((bc) => bc.quantity > 0).length;

  const visibleSetCards = useMemo(() => {
    const q = checklistQuery.trim().toLowerCase();
    if (!q) return setCards;
    return setCards.filter(
      (card) => card.name.toLowerCase().includes(q) || card.number === q.replace(/^#/, "")
    );
  }, [setCards, checklistQuery]);

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
              {binder.pokemon_set_icon_url && (
                <img src={binder.pokemon_set_icon_url} alt="" className="binder-detail__set-icon" />
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
          {setCardsStatus === "error" && <p className="panel__status panel__status--error">Couldn't load this set's checklist right now — Pokémon TCG data is occasionally unavailable, try again in a moment.</p>}
          {setCardsStatus === "ready" && setCards.length === 0 && (
            <p className="panel__status">No cards found for this set right now.</p>
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
                        {card.number ? `#${card.number} ` : ""}{card.name}
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
                            onClick={() => handleChecklistQuantity(card, qty - 1, owned?.condition)}
                          >
                            −
                          </button>
                        )}
                        {qty > 0 && <span className="qty-stepper__count">{qty}</span>}
                        <button
                          type="button"
                          className="qty-stepper__btn qty-stepper__btn--add"
                          aria-label={`Add one ${card.name}`}
                          onClick={() => handleChecklistQuantity(card, qty + 1, owned?.condition || "Near Mint")}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <BinderCardsEditor binderId={binder.id} binderCards={binderCards} status={status} onChange={setBinderCards} />
      )}

      <a href="https://pokemontcg.io" target="_blank" rel="noopener noreferrer" className="ps-trophy-attribution">
        Card data via pokemontcg.io
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
      const { cards } = await searchPokemonCards(nameQuery(addQuery.trim()));
      setAddResults(cards.slice(0, 8));
    } catch (err) {
      console.error("Binder card search failed:", err);
    }
  }

  async function handleAdd(card) {
    try {
      const existing = binderCards.find((bc) => bc.pokemon_card_id === card.id);
      const row = await setBinderCardQuantity(binderId, card, (existing?.quantity || 0) + 1, {});
      onChange((prev) => {
        const others = prev.filter((bc) => bc.pokemon_card_id !== card.id);
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
      const row = await setBinderCardQuantity(binderId, { id: bc.pokemon_card_id, name: bc.card_name, setId: bc.set_id }, qty, { finish: bc.finish });
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
              <span>{card.name} ({card.setName})</span>
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
                <span className="backlog-card__meta">{bc.set_id}</span>
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
