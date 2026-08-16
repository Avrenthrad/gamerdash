// Mock wishlist data for Stage 1 — stands in for a real per-user
// wishlist table once Supabase lands (Stage 5). "addedAt" drives the
// newest-first ordering on the Price Comparison page.

export const initialWishlist = [
  { id: "w1", title: "Hades II", type: "game", addedAt: "2026-07-24T09:15:00Z" },
  { id: "w2", title: "Elden Ring", type: "game", addedAt: "2026-07-20T14:30:00Z" },
  { id: "w3", title: "Baldur's Gate 3", type: "game", addedAt: "2026-07-10T11:00:00Z" },
];
