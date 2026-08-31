// Dedicated Gaming College page — full visual release calendar.

import ReleaseCalendar from "./ReleaseCalendar";

export default function ReleaseCalendarPage({
  onBack,
  wishlist,
  linkedSteamId,
  onOpenBrowse,
}) {
  return (
    <div className="price-page release-calendar-page">
      <button type="button" className="back-link" onClick={onBack}>← Back</button>

      <div className="price-page__head">
        <h1>Release Calendar</h1>
        <p className="price-page__lede">
          Real release dates from RAWG and your Steam wishlist — date-level only, never fabricated unlock times.
        </p>
      </div>

      <div className="panel release-calendar-page__panel">
        <ReleaseCalendar wishlist={wishlist} linkedSteamId={linkedSteamId} />
      </div>

      {onOpenBrowse && (
        <div className="release-calendar-page__footer">
          <button type="button" className="steam-sync-link" onClick={onOpenBrowse}>
            Browse all releases &amp; DLC →
          </button>
        </div>
      )}
    </div>
  );
}
