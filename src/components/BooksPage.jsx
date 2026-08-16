// Books — scan a real barcode (or type an ISBN) -> real Open Library
// lookup -> add to TBR / Reading / Finished / Owned, plus named
// custom lists. Every book here is either scanned/looked-up (real
// Open Library data) or entered by hand — nothing invented.

import { useEffect, useState } from "react";
import { lookupBookByIsbn } from "../lib/openlibrary";
import {
  fetchUserBooks, addUserBook, updateUserBook, removeUserBook,
  fetchBookLists, createBookList, deleteBookList, addBookToList, removeBookFromList,
} from "../lib/books";
import BookBarcodeScanner from "./BookBarcodeScanner";

const STATUS_LABELS = { tbr: "To Be Read", reading: "Reading", finished: "Finished", owned: "Owned" };
const STATUS_TABS = ["all", "tbr", "reading", "finished", "owned"];

export default function BooksPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [books, setBooks] = useState([]);
  const [lists, setLists] = useState([]);
  const [status, setStatus] = useState("loading");
  const [filter, setFilter] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [pendingBook, setPendingBook] = useState(null); // looked-up, not yet saved
  const [lookupStatus, setLookupStatus] = useState("idle");
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function load() {
    setStatus("loading");
    try {
      const [b, l] = await Promise.all([fetchUserBooks(userId), fetchBookLists(userId)]);
      setBooks(b);
      setLists(l);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load books:", err);
      setStatus("error");
    }
  }

  async function handleIsbnFound(isbn) {
    setScanning(false);
    setLookupStatus("loading");
    try {
      const book = await lookupBookByIsbn(isbn);
      if (!book) {
        setLookupStatus("not-found");
        setPendingBook({ isbn, title: "", author: "" });
        return;
      }
      setPendingBook(book);
      setLookupStatus("ready");
    } catch (err) {
      console.error("ISBN lookup failed:", err);
      setLookupStatus("error");
    }
  }

  async function handleSavePending(statusValue) {
    if (!pendingBook?.title) return;
    try {
      await addUserBook(userId, pendingBook, { status: statusValue, source: "barcode" });
      setPendingBook(null);
      setLookupStatus("idle");
      load();
    } catch (err) {
      console.error("Failed to save book:", err);
    }
  }

  async function handleStatusChange(book, newStatus) {
    setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, status: newStatus } : b)));
    try {
      await updateUserBook(book.id, { status: newStatus });
    } catch (err) {
      console.error("Failed to update book status:", err);
    }
  }

  async function handleRemove(bookId) {
    try {
      await removeUserBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err) {
      console.error("Failed to remove book:", err);
    }
  }

  async function handleCreateList(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const list = await createBookList(userId, newListName.trim());
      setLists((prev) => [{ ...list, book_list_items: [] }, ...prev]);
      setNewListName("");
    } catch (err) {
      console.error("Failed to create list:", err);
    }
  }

  async function handleDeleteList(listId) {
    try {
      await deleteBookList(listId);
      setLists((prev) => prev.filter((l) => l.id !== listId));
    } catch (err) {
      console.error("Failed to delete list:", err);
    }
  }

  async function handleToggleListMembership(listId, bookId, isOn) {
    try {
      if (isOn) await removeBookFromList(listId, bookId);
      else await addBookToList(listId, bookId);
      load();
    } catch (err) {
      console.error("Failed to update list membership:", err);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back</button>
          <h1 className="price-page__title">Books</h1>
          <p className="price-page__subtitle">Sign in to scan and track your real books.</p>
        </div>
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  const filteredBooks = filter === "all" ? books : books.filter((b) => b.status === filter);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Books</h1>
        <p className="price-page__subtitle">Scan a real barcode or search by ISBN — powered by Open Library.</p>
      </div>

      {!scanning && !pendingBook && (
        <button type="button" className="price-search__button" onClick={() => setScanning(true)}>
          📷 Scan a book barcode
        </button>
      )}

      {scanning && (
        <>
          <BookBarcodeScanner onDetected={handleIsbnFound} onManualEntry={handleIsbnFound} />
          <button type="button" className="quickdash-reset-btn" onClick={() => setScanning(false)} style={{ marginTop: "8px" }}>
            Cancel
          </button>
        </>
      )}

      {lookupStatus === "loading" && <p className="panel__status">Looking up that ISBN…</p>}

      {lookupStatus === "error" && (
        <p className="panel__status panel__status--error">
          Couldn't reach Open Library right now — try again, or use "Scan a book barcode" to enter it manually.
        </p>
      )}

      {pendingBook && lookupStatus === "not-found" && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">📕</span>
          <p className="empty-state__body">Open Library doesn't have data for ISBN {pendingBook.isbn} — you can still add it with a title you enter yourself.</p>
          <label className="auth-form__field">
            <span>Title</span>
            <input value={pendingBook.title} onChange={(e) => setPendingBook({ ...pendingBook, title: e.target.value })} />
          </label>
          <div className="backlog-add">
            {STATUS_TABS.slice(1).map((s) => (
              <button key={s} type="button" className="quickdash-reset-btn" onClick={() => handleSavePending(s)} disabled={!pendingBook.title.trim()}>
                Add as {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingBook && lookupStatus === "ready" && (
        <div className="backlog-card" style={{ alignItems: "flex-start" }}>
          {pendingBook.coverUrl && <img src={pendingBook.coverUrl} alt="" className="backlog-card__thumb" style={{ width: "56px", height: "84px" }} />}
          <div className="backlog-card__info">
            <span className="backlog-card__title">{pendingBook.title}</span>
            <span className="backlog-card__meta">{pendingBook.author}{pendingBook.publisher ? ` · ${pendingBook.publisher}` : ""}</span>
            <div className="backlog-add" style={{ marginTop: "8px" }}>
              {STATUS_TABS.slice(1).map((s) => (
                <button key={s} type="button" className="quickdash-reset-btn" onClick={() => handleSavePending(s)}>
                  Add as {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="game-popup__close" onClick={() => { setPendingBook(null); setLookupStatus("idle"); }} aria-label="Cancel">✕</button>
        </div>
      )}

      <div className="backlog-status-tabs" style={{ marginTop: "20px" }}>
        {STATUS_TABS.map((s) => (
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

      {status === "loading" && <p className="panel__status">Loading your books…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your books right now.</p>}
      {status === "ready" && filteredBooks.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">📚</span>
          <p className="empty-state__body">Nothing here yet — scan a barcode above to add a real book.</p>
        </div>
      )}

      {filteredBooks.length > 0 && (
        <ul className="backlog-list">
          {filteredBooks.map((book) => (
            <li key={book.id} className="backlog-card">
              {book.cover_url ? (
                <img src={book.cover_url} alt="" className="backlog-card__thumb" style={{ width: "48px", height: "72px" }} />
              ) : (
                <div className="backlog-card__thumb backlog-card__thumb--placeholder" style={{ width: "48px", height: "72px" }} />
              )}
              <div className="backlog-card__info">
                <span className="backlog-card__title">{book.title}</span>
                <span className="backlog-card__meta">{book.author}</span>
              </div>
              <select
                className="backlog-card__status-select"
                value={book.status}
                onChange={(e) => handleStatusChange(book, e.target.value)}
              >
                {STATUS_TABS.slice(1).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <button type="button" className="game-popup__close" onClick={() => handleRemove(book.id)} aria-label="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}

      <div className="backlog-summary" style={{ marginTop: "24px" }}>
        <span className="feed-col__label">Your lists</span>
      </div>

      <form className="price-search" onSubmit={handleCreateList}>
        <input className="price-search__input" type="text" placeholder="New list name…" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
        <button type="submit" className="price-search__button">Create list</button>
      </form>

      {lists.length === 0 && <p className="panel__status">No lists yet — create one above (e.g. "Book club", "Gift ideas").</p>}

      {lists.map((list) => {
        const memberIds = new Set((list.book_list_items || []).map((i) => i.book_id));
        return (
          <div key={list.id} className="settings-card" style={{ marginTop: "10px" }}>
            <div className="backlog-summary" style={{ padding: 0, border: "none" }}>
              <h3 className="settings-card__title" style={{ margin: 0 }}>{list.name}</h3>
              <button type="button" className="game-popup__close" onClick={() => handleDeleteList(list.id)} aria-label={`Delete ${list.name}`}>✕</button>
            </div>
            {books.length === 0 ? (
              <p className="panel__status">Add a book above first.</p>
            ) : (
              <div className="identifier-list">
                {books.map((b) => (
                  <label key={b.id} className="pref-choice">
                    <input
                      type="checkbox"
                      checked={memberIds.has(b.id)}
                      onChange={() => handleToggleListMembership(list.id, b.id, memberIds.has(b.id))}
                    />
                    <span>{b.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
