// Game Services (Dashboard 2) — real countdowns + a real, manually-
// researched calendar (see data/liveServiceCalendar.js for why this
// has to be manually maintained — no platform publishes a live API
// for season/act/patch dates).
//
// Countdowns are computed client-side from known, real reset
// schedules — no API calls needed for these two:
//   - Fortnite shop: resets daily at 00:00 UTC (same fact already
//     used for the shop preview on the In Game Stores page).
//   - Destiny 2 weekly reset: Tuesdays at 17:00 UTC — this has been
//     Bungie's consistent weekly reset time for years, and still
//     applies to weekly activities even after Destiny 2 entered
//     maintenance mode (see destiny2Status below).
//
// Valorant's daily store deliberately isn't shown as a countdown — it
// resets at each account's own local midnight, not a single global
// time, so a single countdown for everyone would just be wrong for
// most people rather than a useful approximation.

import { useEffect, useState } from "react";
import { liveServiceCalendar, destiny2Status } from "../data/liveServiceCalendar";

function useCountdown(getTargetDate) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const target = getTargetDate(now);
      const diffMs = target - now;
      const d = Math.floor(diffMs / 86_400_000);
      const h = Math.floor((diffMs % 86_400_000) / 3_600_000);
      const m = Math.floor((diffMs % 3_600_000) / 60_000);
      setLabel(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return label;
}

function nextUtcMidnight(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function nextWeeklyReset(now) {
  // Next Tuesday at 17:00 UTC.
  const target = new Date(now);
  target.setUTCHours(17, 0, 0, 0);
  const daysUntilTuesday = (2 - target.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + daysUntilTuesday);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 7);
  return target;
}

function formatCalendarDate(isoDate) {
  return new Date(isoDate + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}

export default function LiveServiceSection({ enabledGames }) {
  const fortniteReset = useCountdown(nextUtcMidnight);
  const destinyReset = useCountdown(nextWeeklyReset);

  // Falls back to showing everything if enabledGames isn't provided
  // (e.g. rendered somewhere that hasn't wired Dashfeed Settings
  // through yet) rather than showing nothing.
  const isEnabled = (game) => !enabledGames || enabledGames.includes(game);

  const upcomingCalendar = liveServiceCalendar
    .filter((c) => new Date(c.date + "T23:59:59Z") >= new Date())
    .filter((c) => isEnabled(c.game))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const showFortniteCountdown = isEnabled("Fortnite");
  const showDestinyCountdown = isEnabled("Destiny 2");
  const noCountdowns = !showFortniteCountdown && !showDestinyCountdown;

  return (
    <section id="live-service" className="panel panel--sky panel--wide">
      <div className="panel__head">
        <span className="panel__eyebrow">Dashboard 2</span>
        <h2 className="panel__title">Game Services</h2>
        <p className="panel__subtitle">Real reset timers and upcoming season/patch dates.</p>
      </div>

      <div className="feed-layout">
        <div className="feed-col">
          <span className="feed-col__label">Next up</span>
          {noCountdowns ? (
            <p className="panel__status">
              No games with live countdowns enabled — check Dashfeed Settings.
            </p>
          ) : (
            <ul className="countdown-list">
              {showFortniteCountdown && (
                <li className="countdown-row">
                  <div className="countdown-row__body">
                    <span className="countdown-row__game">Fortnite</span>
                    <span className="countdown-row__label">Daily shop reset</span>
                  </div>
                  <span className="countdown-row__time">{fortniteReset}</span>
                </li>
              )}
              {showDestinyCountdown && (
                <li className="countdown-row">
                  <div className="countdown-row__body">
                    <span className="countdown-row__game">Destiny 2</span>
                    <span className="countdown-row__label">Weekly reset</span>
                  </div>
                  <span className="countdown-row__time">{destinyReset}</span>
                </li>
              )}
            </ul>
          )}
          {showDestinyCountdown && (
            <p className="panel__status game-services__note">{destiny2Status.note}</p>
          )}
        </div>

        <div className="feed-col">
          <span className="feed-col__label">Calendar</span>
          {upcomingCalendar.length === 0 ? (
            <p className="panel__status">No upcoming dates for your enabled games right now.</p>
          ) : (
            <ul className="calendar-list">
              {upcomingCalendar.map((c, i) => (
                <li key={i} className="calendar-row">
                  <span className="calendar-row__date">{formatCalendarDate(c.date)}</span>
                  <div className="calendar-row__body">
                    <span className="calendar-row__event">{c.event}</span>
                    <span className="calendar-row__game">{c.game}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
