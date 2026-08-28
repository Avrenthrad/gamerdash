// Comics — real, user-owned issue library: title, issue #, publisher,
// condition, status (owned / on your pull list / wishlist), and an
// optional real cover photo you upload yourself. Also supports a real
// lookup against Comic Vine's general comics database (all publishers,
// see lib/comicvine.js) — needs a real COMIC_VINE_KEY set server-side,
// degrades to an honest "not set up yet" state until then, same
// pattern as this app's other optional-key integrations.

import { useState, useEffect } from "react";
import { fetchComicIssues, addComicIssue, updateComicIssue, removeComicIssue, uploadEntertainmentCover } from "../lib/comics";
import { searchComicVineIssues } from "../lib/comicvine";

const STATUS_LABELS = { owned: "Owned", pull_list: "Pull list", wishlist: "Wishlist" };
const CONDITIONS = ["Near Mint", "Very Fine", "Fine", "Good", "Fair", "Poor"];

// No Marvel API is wired in (Marvel Unlimited/Comics API access isn't
// something this project has scoped or verified) — for Marvel-
// published issues this is just a plain external link out to
// marvel.com's real comics section, not a data integration.
function isMarvelPublisher(publisher) {
  return Boolean(publisher && /marvel/i.test(publisher));
}

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

  // Set by a real Comic Vine match — a real hosted image URL, used
  // as-is rather than re-uploaded to our own Storage bucket. Cleared
  // if the person picks a different cover photo manually instead.
  const [catalogCoverUrl, setCatalogCoverUrl] = useState(null);
  const [showComicVineSearch, setShowComicVineSearch] = useState(false);
  const [comicVineQuery, setComicVineQuery] = useState("");
  const [comicVineResults, setComicVineResults] = useState([]);
  const [comicVineStatus, setComicVineStatus] = useState("idle"); // idle | loading | ready | error | no_key

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
      // A real Comic Vine cover URL is used as-is; a manually chosen
      // file is uploaded to our own Storage — a catalog match takes
      // priority only if the person didn't then also pick a file.
      let coverUrl = catalogCoverUrl;
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
      setCatalogCoverUrl(null);
    } catch (err) {
      console.error("Failed to add comic issue:", err);
    }
    setSaving(false);
  }

  async function handleComicVineSearch(e) {
    e.preventDefault();
    if (!comicVineQuery.trim()) return;
    setComicVineStatus("loading");
    try {
      const results = await searchComicVineIssues(comicVineQuery.trim());
      if (results === "no_key") {
        setComicVineStatus("no_key");
        return;
      }
      setComicVineResults(results);
      setComicVineStatus("ready");
    } catch (err) {
      console.error("Comic Vine search failed:", err);
      setComicVineStatus("error");
    }
  }

  // Publisher is deliberately left for the person to fill in — Comic
  // Vine's real issue-search results don't include it (only the
  // volume/series resource does, a separate lookup this doesn't make),
  // so auto-filling it here would mean guessing rather than using real
  // matched data.
  function handlePickComicVineIssue(issue) {
    setTitle(issue.volumeName || issue.name);
    setIssueNumber(issue.issueNumber ? `#${issue.issueNumber}` : "");
    setCatalogCoverUrl(issue.imageUrl);
    setCoverFile(null);
    setShowComicVineSearch(false);
    setComicVineResults([]);
    setComicVineQuery("");
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
          <button type="button" className="quickdash-reset-btn" onClick={() => setShowComicVineSearch((v) => !v)}>
            {showComicVineSearch ? "Cancel search" : "🔍 Search real Comic Vine catalog"}
          </button>
        </div>

        {showComicVineSearch && (
          <div className="backlog-add">
            <form className="price-search" onSubmit={handleComicVineSearch}>
              <input
                className="price-search__input"
                type="text"
                placeholder="Search real comic issues…"
                value={comicVineQuery}
                onChange={(e) => setComicVineQuery(e.target.value)}
              />
              <button type="submit" className="price-search__button" disabled={comicVineStatus === "loading"}>
                {comicVineStatus === "loading" ? "Searching…" : "Search"}
              </button>
            </form>
            {comicVineStatus === "no_key" && <p className="panel__status">Comic catalog search isn't set up yet — fill in the details manually below.</p>}
            {comicVineStatus === "error" && <p className="panel__status panel__status--error">Couldn't load the comics catalog right now.</p>}
            {comicVineStatus === "ready" && comicVineResults.length === 0 && <p className="panel__status">No matches — try a different search.</p>}
            {comicVineResults.length > 0 && (
              <ul className="backlog-search-results">
                {comicVineResults.map((issue) => (
                  <li key={issue.id} className="backlog-search-results__row">
                    {issue.imageUrl && <img src={issue.imageUrl} alt="" loading="lazy" decoding="async" />}
                    <span>{issue.volumeName || issue.name}{issue.issueNumber ? ` #${issue.issueNumber}` : ""}</span>
                    <button type="button" className="linking-row__connect" onClick={() => handlePickComicVineIssue(issue)}>
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {catalogCoverUrl && !coverFile && (
          <img src={catalogCoverUrl} alt="" className="backlog-card__thumb" style={{ alignSelf: "flex-start" }} decoding="async" />
        )}

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
          <input type="file" accept="image/*" onChange={(e) => { setCoverFile(e.target.files?.[0] || null); setCatalogCoverUrl(null); }} hidden />
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
                <img src={issue.cover_url} alt="" className="backlog-card__thumb" style={{ width: "48px", height: "72px" }} loading="lazy" decoding="async" />
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
              {isMarvelPublisher(issue.publisher) && (
                <a
                  href="https://www.marvel.com/comics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quickdash-reset-btn"
                  title="Open Marvel's comics site in a new tab"
                >
                  Marvel ↗
                </a>
              )}
              <button type="button" className="game-popup__close" onClick={() => handleRemove(issue.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
