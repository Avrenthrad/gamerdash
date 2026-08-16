// Client-side helper for Open5e's real D&D 5e SRD API. See
// api/open5e.js for field-verification notes.

import { API_BASE } from "./apiBase";

export async function searchSpells(query) {
  const res = await fetch(`${API_BASE}/api/open5e?mode=search-spells&q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((s) => ({
    slug: s.slug, name: s.name, desc: s.desc, level: s.level, school: s.school,
  }));
}

export async function searchMonsters(query) {
  const res = await fetch(`${API_BASE}/api/open5e?mode=search-monsters&q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((m) => ({
    slug: m.slug, name: m.name, desc: m.desc, cr: m.challenge_rating, type: m.type,
  }));
}
