// Live service calendar — real, manually-researched dates, same
// pattern as saleEvents.js: no platform publishes a live API for this
// (season/act/patch dates), so these are researched real dates that
// need periodic manual updates, not something that self-refreshes.
// Verified as of when this was last checked (see comments per entry).

export const liveServiceCalendar = [
  {
    date: "2026-08-12",
    game: "League of Legends",
    event: "Patch 26.16 releases",
  },
  {
    date: "2026-08-19",
    game: "Fortnite",
    event: "Current season ends",
  },
  {
    date: "2026-08-19",
    game: "Valorant",
    event: "Act 4 ends (rank reset)",
  },
];

// Destiny 2 is a special case, not a normal calendar entry — Bungie
// ended live-service content updates on June 9, 2026 (their final
// content update, Monument of Triumph). The game continues indefinitely
// in what's effectively maintenance mode, with no further seasons on
// the schedule. Real, current information, just not the same shape as
// "next season starts on X" the way the others are.
export const destiny2Status = {
  note: "Destiny 2 entered maintenance mode on June 9, 2026 — Bungie's final content update. No further seasons are scheduled.",
};
