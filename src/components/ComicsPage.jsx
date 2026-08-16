// Comics — real, user-owned issue library: title, issue #, publisher,
// condition, status (owned / on your pull list / wishlist), and an
// optional real cover photo you upload yourself. Manual entry only —
// see lib/comics.js for why no external comics database is wired in
// yet (honest, not a placeholder).

import { useState, useEffect } from "react";
import { fetchComicIssues, addComicIssue, updateComicIssue, removeComicIssue, uploadEntertainmentCover } from "../lib/comics";

const STATUS_LABELS = { owned: "Owned", pull_list: "Pull list", wishlist: "Wishlist" };
const CONDITIONS = ["Near Mint", "Very Fine", "Fine", "Good", "Fair", "Poor"];

export default function ComicsPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState("loading");
  const [filter, setFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [publisher, setPublisher] = useState("");
  const [condition, setCondition] = useState("Near Mint");
  const [addStatus, setAddStatus] = useState("owned");
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function load() {
    setStatus("loading");
    try {
      const rows = await fetchComicIssues(userId);
      setIssues(rows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load comics:", err);
      setStatus("error");
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      let coverUrl = null;
      if (coverFile) coverUrl = await uploadEntertainmentCover(userId, coverFile);

      const issue = await addComicIssue(userId, {
        title: title.trim(),
        issue_number: issueNumber.trim() || null,
        publisher: publisher.trim() || null,
        condition,
        status: addStatus,
        cover_url: coverUrl,
      });
      setIssues((prev) => [issue, ...prev]);
      setTitle("");
      setIssueNumber("");
      setPublisher("");
      setCoverFile(null);
    } catch (err) {
      console.error("Failed to add comic issue:", err);
    }
    setSaving(false);
  }

  async function handleStatusChange(issue, newStatus) {
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: newStatus } : i)));
    try {
      await updateComicIssue(issue.id, { status: newStatus });
    } catch (err) {
      console.error("Failed to update comic status:", err);
    }
  }

  async function handleRemove(issueId) {
    try {
      await removeComicIssue(issueId);
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
    } catch (err) {
      console.error("Failed to remove comic issue:", err);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back</button>
          <h1 className="price-page__title">Comics</h1>
          <p className="price-page__subtitle">Sign in to track your real comic collection.</p>
        </div>
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  const filtered = filter === "all" ? issues : issues.filter((i) => i.status === filter);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Comics</h1>
        <p className="price-page__subtitle">Your real issue library — status, condition, pull list, and covers.</p>
      </div>

      <form className="settings-card" onSubmit={handleAdd}>
        <h2 className="settings-card__title">Add an issue</h2>
        <div className="settings-form-row">
          <label className="auth-form__field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Amazing Spider-Man" required />
          </label>
          <label className="auth-form__field">
            <span>Issue #</span>
            <input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} placeholder="#1" />
          </label>
        </div>
        <div className="settings-form-row">
          <label className="auth-form__field">
            <span>Publisher</span>
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Marvel" />
          </label>
          <label className="auth-form__field">
            <span>Condition</span>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="pref-choice-group" role="radiogroup" aria-label="Status">
          {Object.entries(STATUS_LABELS).map(([id, label]) => (
            <label key={id} className="pref-choice">
              <input type="radio" name="addStatus" value={id} checked={addStatus === id} onChange={(e) => setAddStatus(e.target.value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="settings-avatar__upload">
          {coverFile ? coverFile.name : "Upload a cover photo (optional)"}
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} hidden />
        </label>
        <button type="submit" className="price-search__button" disabled={saving || !title.trim()} style={{ marginTop: "10px" }}>
          {saving ? "Adding…" : "Add issue"}
        </button>
      </form>

      <div className="backlog-status-tabs" style={{ marginTop: "20px" }}>
        {["all", "owned", "pull_list", "wishlist"].map((s) => (
          <button
            key={s}
            type="button"
            className={`quickdash-reset-btn ${filter === s ? "quickdash-reset-btn--active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="panel__status">Loading your comics…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your comics right now.</p>}
      {status === "ready" && filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">📖</span>
          <p className="empty-state__body">Nothing here yet — add your first issue above.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="backlog-list">
          {filtered.map((issue) => (
            <li key={issue.id} className="backlog-card">
              {issue.cover_url ? (
                <img src={issue.cover_url} alt="" className="backlog-card__thumb" style={{ width: "48px", height: "72px" }} />
              ) : (
                <div className="backlog-card__thumb backlog-card__thumb--placeholder" style={{ width: "48px", height: "72px" }} />
              )}
              <div className="backlog-card__info">
                <span className="backlog-card__title">{issue.title}{issue.issue_number ? ` ${issue.issue_number}` : ""}</span>
                <span className="backlog-card__meta">{issue.publisher}{issue.publisher ? " · " : ""}{issue.condition}</span>
              </div>
              <select
                className="backlog-card__status-select"
                value={issue.status}
                onChange={(e) => handleStatusChange(issue, e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <button type="button" className="game-popup__close" onClick={() => handleRemove(issue.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
