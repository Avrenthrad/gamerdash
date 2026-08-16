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
    posterUrl: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-M.jpg` : null,
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
