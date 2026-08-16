// Named store-wide sale events (e.g. "Steam Autumn Sale", "Xbox
// Ultimate Game Sale").
//
// IMPORTANT: no store publishes a live API for this — CheapShark only
// gives per-game discounts, XBXprices only gives per-game Xbox
// prices, and neither Steam nor Microsoft have an official endpoint
// for named sale events with dates (checked; nothing exists). So this
// list is manually maintained real dates, not fetched live. Update it
// periodically as new events are announced — it will NOT update itself.
//
// Dates below reflect real, researched events as of when this was
// last checked (the Xbox one is currently live).

export const saleEvents = [
  { name: "Xbox Ultimate Game Sale (Summer Sale)", store: "Xbox Store", start: "2026-07-08T00:00:00Z", end: "2026-07-29T23:59:59Z" },
  { name: "Steam Autumn Sale", store: "Steam", start: "2026-10-01T00:00:00Z", end: "2026-10-08T23:59:59Z" },
  { name: "Steam Next Fest", store: "Steam", start: "2026-10-19T00:00:00Z", end: "2026-10-26T23:59:59Z" },
];

export function describeEventStatus(event) {
  const now = Date.now();
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();

  if (now < start) {
    const days = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return { label: `Starts in ${days} day${days === 1 ? "" : "s"}`, state: "upcoming" };
  }
  if (now <= end) {
    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return { label: `Live now — ends in ${days} day${days === 1 ? "" : "s"}`, state: "live" };
  }
  return { label: "Ended", state: "ended" };
}
