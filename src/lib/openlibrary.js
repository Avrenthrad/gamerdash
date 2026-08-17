// Client-side helper for Open Library's real book search API. See
// api/openlibrary.js for field-verification and rate-limit notes.

import { API_BASE } from "./apiBase";

const COVER_BASE = "https://covers.openlibrary.org/b/id";

function normalizeResult(doc) {
  return {
    // Open Library's key is a path like "/works/OL1907096W" — used as
    // this entry's stable identifier, same role `id` plays for the
    // other Entertainment sources.
    id: doc.key,
    title: doc.title || "",
    overview: "", // Open Library's search endpoint doesn't return a synopsis — description would need a separate per-work request, not fetched here to keep this a single request per search
    releaseDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
    posterUrl: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-L.jpg` : null,
    voteAverage: null, // Open Library's search endpoint doesn't return a rating
    author: doc.author_name?.[0] || null,
    mediaKind: "book",
  };
}

export async function searchBooks(query) {
  const res = await fetch(`${API_BASE}/api/openlibrary?mode=search&q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(normalizeResult);
}

// Real cover-by-ISBN URL — Open Library's own documented image
// service, verified live (302-redirects to a real cover), same
// pattern as the cover_i-based URLs above.
export function coverUrlForIsbn(isbn) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

// Barcode-scan -> book lookup. Returns null (not an error) for a real
// ISBN Open Library just doesn't have data for — a genuinely honest
// "not found", not a failure.
export async function lookupBookByIsbn(isbn) {
  const res = await fetch(`${API_BASE}/api/openlibrary?mode=isbn&isbn=${encodeURIComponent(isbn)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const book = data.book;
  if (!book) return null;
  return {
    isbn,
    title: book.title || "",
    author: book.authors?.[0]?.name || null,
    coverUrl: coverUrlForIsbn(isbn),
    publisher: book.publishers?.[0]?.name || null,
    publishDate: book.publish_date || null,
  };
}
