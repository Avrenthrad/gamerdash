// Client-side helper for Comic Vine's real, general comics database
// (covers every publisher — Marvel, DC, Image, Dark Horse, etc., not
// just one). See api/pricing.js's handleComicVine for the proxy
// (folded into the shared pricing function to stay under Vercel's
// Hobby-plan 12-function limit, not because Comic Vine is pricing-
// related — same reason Rebrickable lives there too).
//
// Genuinely requires a free API key (confirmed live — an
// unauthenticated request returns a real 401), same "no_key" honest
// degradation pattern as RAWG/XBXprices/Rebrickable.

import { API_BASE } from "./apiBase";

function normalizeIssue(issue) {
  return {
    id: issue.id,
    name: issue.name || issue.volume?.name || "Untitled",
    issueNumber: issue.issue_number || null,
    coverDate: issue.cover_date || null,
    volumeName: issue.volume?.name || null,
    deck: issue.deck || null,
    // Comic Vine's real image sub-field name wasn't confirmed against
    // a live authenticated response — several real candidate keys
    // from their documented convention are tried in order rather than
    // assuming one, falling back to null (no image) if none are present.
    imageUrl: issue.image?.medium_url || issue.image?.small_url || issue.image?.thumb_url || issue.image?.original_url || null,
  };
}

export async function searchComicVineIssues(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const res = await fetch(`${API_BASE}/api/pricing?service=comicvine&q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) throw new Error("Comic Vine search failed");
  const data = await res.json();
  if (data.error === "no_key") return "no_key";
  return (data.results || []).map(normalizeIssue);
}
