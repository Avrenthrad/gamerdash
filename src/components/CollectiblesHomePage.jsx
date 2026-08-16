// Collectibles College — real personal inventory, now with real
// section navigation (My Shelf / Add Item / Hardware / Wishlist /
// Stats) matching the approved shell direction. Still pure CRUD, no
// external API dependency yet — no general catalogue exists for most
// of these types (Funko, statues, pins), verified during scoping.

import { useEffect, useState } from "react";
import { fetchCollectibles, addCollectible, updateCollectible, removeCollectible } from "../lib/collectibles";

const TYPE_GROUPS = [
  { label: "Figures & Statues", types: ["figure", "statue", "funko_pop"] },
  { label: "Builds", types: ["lego_set", "model_kit"] },
  { label: "Play Hardware", types: ["console", "controller", "accessory", "amiibo"] },
  { label: "Display Smalls", types: ["pin", "prop"] },
  { label: "Media & Editions", types: ["vinyl_music", "print", "collectors_edition"] },
  { label: "Other", types: ["other"] },
];

const TYPE_LABELS = {
  figure: "Figure", statue: "Statue", funko_pop: "Funko Pop", lego_set: "LEGO Set",
  model_kit: "Model Kit", amiibo: "Amiibo", prop: "Prop", pin: "Pin",
  vinyl_music: "Vinyl / Music", print: "Print", collectors_edition: "Collector's Edition",
  console: "Console", controller: "Controller", accessory: "Accessory", other: "Other",
};

const HARDWARE_TYPES = ["console", "controller", "accessory", "amiibo"];

const PACKAGE_STATES = ["sealed", "opened_boxed", "loose", "boxed_complete", "boxed_incomplete", "discarded_box"];
const PACKAGE_STATE_LABELS = {
  sealed: "Sealed", opened_boxed: "Opened (boxed)", loose: "Loose",
  boxed_complete: "Boxed, complete", boxed_incomplete: "Boxed, incomplete", discarded_box: "Box discarded",
};

const CONDITIONS = ["mint", "near_mint", "good", "fair", "poor"];
const CONDITION_LABELS = { mint: "Mint", near_mint: "Near Mint", good: "Good", fair: "Fair", poor: "Poor" };

export default function CollectiblesHomePage({ onBack, isLoggedIn, userId, onSignIn, onCreateAccount }) {
  const [section, setSection] = useState("shelf"); // shelf | add | hardware | wishlist | stats
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function loadEntries() {
    setStatus("loading");
    try {
      const rows = await fetchCollectibles(userId);
      setEntries(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load collectibles:", err);
      setStatus("error");
    }
  }

  async function handleStateChange(entryId, field, value) {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, [field]: value } : e)));
    try {
      await updateCollectible(entryId, { [field]: value });
    } catch (err) {
      console.error("Failed to update collectible:", err);
    }
  }

  async function handleRemove(entryId) {
    try {
      await removeCollectible(entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.error("Failed to remove collectible:", err);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back to Overview</button>
          <h1 className="price-page__title">Collectibles</h1>
          <p className="price-page__subtitle">Your real shelf — Pops, statues, LEGO, hardware, and more.</p>
        </div>
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  const owned = entries.filter((e) => !e.is_wishlist);
  const wishlist = entries.filter((e) => e.is_wishlist);
  const hardware = owned.filter((e) => HARDWARE_TYPES.includes(e.type));

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Overview</button>
        <h1 className="price-page__title">Collectibles</h1>
        <p className="price-page__subtitle">
          My user-entered inventory. Real lookups (LEGO via Rebrickable, vinyl via Discogs) are a planned next step.
        </p>
      </div>

      <div className="backlog-status-tabs">
        <button type="button" className={`quickdash-reset-btn ${section === "shelf" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setSection("shelf")}>My Shelf</button>
        <button type="button" className={`quickdash-reset-btn ${section === "add" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setSection("add")}>Add Item</button>
        <button type="button" className={`quickdash-reset-btn ${section === "hardware" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setSection("hardware")}>Hardware</button>
        <button type="button" className={`quickdash-reset-btn ${section === "wishlist" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setSection("wishlist")}>Wishlist</button>
        <button type="button" className={`quickdash-reset-btn ${section === "stats" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setSection("stats")}>Stats</button>
      </div>

      {status === "loading" && <p className="panel__status">Loading your shelf…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your shelf right now.</p>}

      {status === "ready" && section === "shelf" && (
        <EntryList
          entries={owned}
          emptyMessage="Your shelf is empty — use Add Item to get started."
          onStateChange={handleStateChange}
          onRemove={handleRemove}
        />
      )}

      {section === "add" && (
        <AddItemForm userId={userId} onAdded={() => { loadEntries(); setSection("shelf"); }} />
      )}

      {status === "ready" && section === "hardware" && (
        <EntryList
          entries={hardware}
          emptyMessage="No hardware yet — consoles, controllers, accessories, and amiibo show up here."
          onStateChange={handleStateChange}
          onRemove={handleRemove}
        />
      )}

      {status === "ready" && section === "wishlist" && (
        <EntryList
          entries={wishlist}
          emptyMessage="Nothing on your wishlist yet — add an item and mark it as wishlist."
          onStateChange={handleStateChange}
          onRemove={handleRemove}
        />
      )}

      {status === "ready" && section === "stats" && <StatsView owned={owned} />}
    </div>
  );
}

function EntryList({ entries, emptyMessage, onStateChange, onRemove }) {
  if (entries.length === 0) return <p className="panel__status">{emptyMessage}</p>;
  return (
    <ul className="backlog-list">
      {entries.map((entry) => (
        <li key={entry.id} className="backlog-card">
          <div className="backlog-card__info">
            <span className="backlog-card__title">{entry.title} {entry.qty > 1 && `×${entry.qty}`}</span>
            <div className="backlog-card__meta">
              <span>{TYPE_LABELS[entry.type]}</span>
              <span className="score-badge">{PACKAGE_STATE_LABELS[entry.package_state]}</span>
              <span>{CONDITION_LABELS[entry.condition]}</span>
              {entry.price_paid != null && <span>${Number(entry.price_paid).toFixed(2)}</span>}
            </div>
            {entry.notes && <span className="backlog-card__meta">{entry.notes}</span>}
          </div>
          <select
            className="backlog-card__status-select"
            value={entry.package_state}
            onChange={(e) => onStateChange(entry.id, "package_state", e.target.value)}
          >
            {PACKAGE_STATES.map((s) => (
              <option key={s} value={s}>{PACKAGE_STATE_LABELS[s]}</option>
            ))}
          </select>
          <button type="button" className="game-popup__close" onClick={() => onRemove(entry.id)} aria-label="Remove">✕</button>
        </li>
      ))}
    </ul>
  );
}

function AddItemForm({ userId, onAdded }) {
  const [type, setType] = useState("funko_pop");
  const [title, setTitle] = useState("");
  const [packageState, setPackageState] = useState("sealed");
  const [condition, setCondition] = useState("mint");
  const [qty, setQty] = useState(1);
  const [pricePaid, setPricePaid] = useState("");
  const [notes, setNotes] = useState("");
  const [isWishlist, setIsWishlist] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await addCollectible(userId, {
        type, title: title.trim(), packageState, condition,
        qty: Number(qty) || 1, pricePaid: pricePaid ? Number(pricePaid) : null,
        notes: notes.trim() || null, isWishlist,
      });
      onAdded();
    } catch (err) {
      console.error("Failed to add collectible:", err);
    }
  }

  return (
    <form className="backlog-add" onSubmit={handleAdd} style={{ marginTop: "16px" }}>
      <label className="auth-form__field">
        <span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="auth-form__field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Batman (Chase Variant)" required />
      </label>

      <div className="settings-form-row">
        <label className="auth-form__field">
          <span>Package state</span>
          <select value={packageState} onChange={(e) => setPackageState(e.target.value)}>
            {PACKAGE_STATES.map((s) => (
              <option key={s} value={s}>{PACKAGE_STATE_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="auth-form__field">
          <span>Condition</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="settings-form-row">
        <label className="auth-form__field">
          <span>Quantity</span>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label className="auth-form__field">
          <span>Price paid (optional)</span>
          <input type="number" min="0" step="0.01" value={pricePaid} onChange={(e) => setPricePaid(e.target.value)} placeholder="e.g. 24.99" />
        </label>
      </div>

      <label className="auth-form__field">
        <span>Notes (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where you got it, condition details, etc." />
      </label>

      <label className="pref-choice">
        <input type="checkbox" checked={isWishlist} onChange={(e) => setIsWishlist(e.target.checked)} />
        <span>This is a wishlist item (don't own it yet)</span>
      </label>

      <button type="submit" className="linking-row__connect">Save item</button>
    </form>
  );
}

function StatsView({ owned }) {
  const totalItems = owned.reduce((sum, e) => sum + e.qty, 0);
  const sealedCount = owned.filter((e) => e.package_state === "sealed").reduce((sum, e) => sum + e.qty, 0);
  const totalPaid = owned.reduce((sum, e) => sum + (Number(e.price_paid) || 0) * e.qty, 0);
  const anyPriceEntered = owned.some((e) => e.price_paid != null);

  if (owned.length === 0) {
    return <p className="panel__status">Nothing on your shelf yet — stats will show up once you add items.</p>;
  }

  return (
    <div className="backlog-summary" style={{ marginTop: "16px" }}>
      <div className="panel__stat">
        <span className="panel__stat-value">{owned.length}</span>
        <span className="panel__stat-label">Entries</span>
      </div>
      <div className="panel__stat">
        <span className="panel__stat-value">{totalItems}</span>
        <span className="panel__stat-label">Total items</span>
      </div>
      <div className="panel__stat">
        <span className="panel__stat-value">{sealedCount}</span>
        <span className="panel__stat-label">Sealed</span>
      </div>
      {anyPriceEntered && (
        <div className="panel__stat">
          <span className="panel__stat-value">${totalPaid.toFixed(2)}</span>
          <span className="panel__stat-label">Total paid (entered only)</span>
        </div>
      )}
    </div>
  );
}
