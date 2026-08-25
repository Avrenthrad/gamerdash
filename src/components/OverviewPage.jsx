// Overview — cross-College summary. Every card shows a real number or
// an honest empty state — never a fabricated one. Entertainment,
// Collectibles, and Tabletop all get the exact same "not built yet"
// treatment as each other, since none of them have any real data
// behind them yet — showing a fabricated count for two of the three
// while the third got an honest empty state was a real inconsistency
// caught in an earlier design pass, not something to repeat here.

import { useEffect, useState } from "react";
import { fetchOwnedGames } from "../lib/steam";
import { fetchCollection } from "../lib/mtg";
import { fetchEntertainmentEntries } from "../lib/entertainment";
import { fetchCollectibles } from "../lib/collectibles";
import { fetchCampaigns, fetchArmies } from "../lib/tabletop";
import { fetchRecentActivityForUser, describeActivity } from "../lib/guilds";
import SteamPresenceCard from "./SteamPresenceCard";
import FriendsActivityCard from "./FriendsActivityCard";
import GuildPulseCard from "./GuildPulseCard";
import CollegeIcon from "./CollegeIcon";
import CollegeMorphHero from "./CollegeMorphHero";
import HorizontalLane from "./mobile/HorizontalLane";

const NOT_BUILT_COLLEGES = [];

// Animates 0 -> target once real data is in, instead of just swapping
// the number in — the one deliberate "wow" moment on the app's front
// page. Skips straight to the final value under reduced-motion.
function useCountUp(target, active) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || target <= 0) {
      setValue(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let raf;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  return value;
}

export default function OverviewPage({
  isLoggedIn,
  userId,
  linkedSteamId,
  selectedColleges,
  onOpenCollege,
  onGoToFriends,
  onGoToGuilds,
}) {
  const [gameCount, setGameCount] = useState(null);
  const [cardCount, setCardCount] = useState(null);
  const [entertainmentCount, setEntertainmentCount] = useState(null);
  const [collectiblesCount, setCollectiblesCount] = useState(null);
  const [tabletopCount, setTabletopCount] = useState(null);
  const [status, setStatus] = useState("idle");
  const [tickerActivity, setTickerActivity] = useState([]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setStatus("loading");

    Promise.all([
      linkedSteamId ? fetchOwnedGames(linkedSteamId).then((g) => g.length) : Promise.resolve(null),
      userId ? fetchCollection(userId).then((c) => c.reduce((sum, e) => sum + (e.quantity || 1), 0)) : Promise.resolve(null),
      userId ? fetchEntertainmentEntries(userId).then((e) => e.length) : Promise.resolve(null),
      userId ? fetchCollectibles(userId).then((c) => c.filter((e) => !e.is_wishlist).reduce((sum, e) => sum + (e.qty || 1), 0)) : Promise.resolve(null),
      userId ? Promise.all([fetchCampaigns(userId), fetchArmies(userId)]).then(([c, a]) => c.length + a.length) : Promise.resolve(null),
    ])
      .then(([games, cards, entertainment, collectibles, tabletop]) => {
        setGameCount(games);
        setCardCount(cards);
        setEntertainmentCount(entertainment);
        setCollectiblesCount(collectibles);
        setTabletopCount(tabletop);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Overview data fetch failed:", err);
        setStatus("error");
      });
  }, [isLoggedIn, userId, linkedSteamId]);

  // Kept as its own effect/request, separate from the Promise.all
  // above, so a Guild-activity hiccup can never take down the hero
  // number or College tiles (and vice versa).
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    fetchRecentActivityForUser(userId, 8)
      .then(setTickerActivity)
      .catch((err) => console.error("Overview ticker fetch failed:", err));
  }, [isLoggedIn, userId]);

  const showGaming = selectedColleges.includes("gaming");
  const showTcg = selectedColleges.includes("tcg");

  const heroReady = isLoggedIn && status === "ready";
  const totalCollected = (gameCount || 0) + (cardCount || 0) + (entertainmentCount || 0) + (collectiblesCount || 0) + (tabletopCount || 0);

  // Only real, already-fetched numbers make the rotation — no invented
  // stats. A count of 0 still counts as "real" (matches this page's
  // existing honest-empty-state rule above), so it isn't filtered out;
  // only Colleges the user hasn't turned on, or that never returned
  // data (null), are skipped.
  const heroSlides = [
    { key: "total", label: "Your collection", value: totalCollected, unit: "pieces collected across your Colleges" },
    showGaming && gameCount !== null && { key: "gaming", label: "Gaming library", value: gameCount, unit: "games in your library" },
    showTcg && cardCount !== null && { key: "tcg", label: "TCG collection", value: cardCount, unit: "cards collected" },
    selectedColleges.includes("entertainment") && entertainmentCount !== null && { key: "entertainment", label: "Entertainment", value: entertainmentCount, unit: "movies, shows, anime & books tracked" },
    selectedColleges.includes("collectibles") && collectiblesCount !== null && { key: "collectibles", label: "Collectibles", value: collectiblesCount, unit: "items on your shelf" },
    selectedColleges.includes("tabletop") && tabletopCount !== null && { key: "tabletop", label: "Tabletop", value: tabletopCount, unit: "campaigns & armies" },
  ].filter(Boolean);

  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!heroReady || paused || heroSlides.length < 2) return;
    const timer = setInterval(() => {
      setSlideIndex((i) => (i + 1) % heroSlides.length);
    }, 4200);
    return () => clearInterval(timer);
    // heroSlides is rebuilt every render, but its length/identity per
    // College selection is what actually matters for the interval —
    // depending on the array itself would restart the timer on every
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroReady, paused, heroSlides.length]);

  // Clamp in case a College got deselected mid-rotation and shrank the list.
  const currentSlide = heroSlides[slideIndex % heroSlides.length] || heroSlides[0];
  const animatedValue = useCountUp(currentSlide?.value ?? 0, heroReady);

  return (
    <div className="overview-page">
      <div className="price-page__head">
        <h1 className="price-page__title">Overview</h1>
        <p className="price-page__subtitle">What's actually going on across your Colleges.</p>
      </div>

      <CollegeMorphHero />

      {heroReady && currentSlide && (
        <div
          className="overview-hero"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <span className="overview-hero__eyebrow">{currentSlide.label}</span>
          <div className="overview-hero__value" key={currentSlide.key}>
            <span className="overview-hero__aura" aria-hidden="true" />
            <span className="overview-hero__number">{animatedValue.toLocaleString()}</span>
            <span className="overview-hero__unit">{currentSlide.unit}</span>
          </div>

          {heroSlides.length > 1 && (
            <div className="hero-card__dots" role="tablist" aria-label="Collection stat">
              {heroSlides.map((slide, i) => (
                <button
                  key={slide.key}
                  type="button"
                  role="tab"
                  aria-selected={i === slideIndex}
                  aria-label={slide.label}
                  className={`hero-card__dot ${i === slideIndex ? "hero-card__dot--active" : ""}`}
                  onClick={() => setSlideIndex(i)}
                />
              ))}
            </div>
          )}

          {tickerActivity.length > 0 && (
            <div className="overview-ticker">
              <div className="overview-ticker__track">
                {[...tickerActivity, ...tickerActivity].map((entry, i) => (
                  <span className="overview-ticker__item" key={`${entry.id}-${i}`}>
                    <span className="overview-ticker__dot" aria-hidden="true" />
                    {describeActivity(entry)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoggedIn && (
        <HorizontalLane label="Right now">
          {showGaming && <SteamPresenceCard userId={userId} />}
          <GuildPulseCard userId={userId} onGoToGuilds={onGoToGuilds} />
          <FriendsActivityCard userId={userId} onGoToFriends={onGoToFriends} />
        </HorizontalLane>
      )}

      {(showGaming ||
        showTcg ||
        selectedColleges.includes("entertainment") ||
        selectedColleges.includes("collectibles") ||
        selectedColleges.includes("tabletop") ||
        NOT_BUILT_COLLEGES.some((c) => selectedColleges.includes(c.id))) && (
        <HorizontalLane label="Colleges" className="overview-grid">
          {showGaming && (
            <button type="button" className="overview-card" onClick={() => onOpenCollege("gaming")}>
              <span className="overview-card__icon"><CollegeIcon collegeId="gaming" size={22} /></span>
              <span className="overview-card__label">Gaming</span>
              {!linkedSteamId ? (
                <span className="overview-card__empty">Link Steam to see your library here</span>
              ) : status === "loading" ? (
                <span className="overview-card__value">…</span>
              ) : (
                <>
                  <span className="overview-card__value">{gameCount ?? 0}</span>
                  <span className="overview-card__unit">games</span>
                </>
              )}
            </button>
          )}

          {showTcg && (
            <button type="button" className="overview-card" onClick={() => onOpenCollege("tcg")}>
              <span className="overview-card__icon"><CollegeIcon collegeId="tcg" size={22} /></span>
              <span className="overview-card__label">TCG</span>
              {status === "loading" ? (
                <span className="overview-card__value">…</span>
              ) : cardCount ? (
                <>
                  <span className="overview-card__value">{cardCount}</span>
                  <span className="overview-card__unit">cards</span>
                </>
              ) : (
                <span className="overview-card__empty">No cards yet — add some in TCG</span>
              )}
            </button>
          )}

          {selectedColleges.includes("entertainment") && (
            <button type="button" className="overview-card" onClick={() => onOpenCollege("entertainment")}>
              <span className="overview-card__icon"><CollegeIcon collegeId="entertainment" size={22} /></span>
              <span className="overview-card__label">Entertainment</span>
              {status === "loading" ? (
                <span className="overview-card__value">…</span>
              ) : entertainmentCount ? (
                <>
                  <span className="overview-card__value">{entertainmentCount}</span>
                  <span className="overview-card__unit">tracked</span>
                </>
              ) : (
                <span className="overview-card__empty">Nothing tracked yet — add a movie, show, anime, or book</span>
              )}
            </button>
          )}

          {selectedColleges.includes("collectibles") && (
            <button type="button" className="overview-card" onClick={() => onOpenCollege("collectibles")}>
              <span className="overview-card__icon"><CollegeIcon collegeId="collectibles" size={22} /></span>
              <span className="overview-card__label">Collectibles</span>
              {status === "loading" ? (
                <span className="overview-card__value">…</span>
              ) : collectiblesCount ? (
                <>
                  <span className="overview-card__value">{collectiblesCount}</span>
                  <span className="overview-card__unit">on your shelf</span>
                </>
              ) : (
                <span className="overview-card__empty">Nothing on your shelf yet — add an item</span>
              )}
            </button>
          )}

          {selectedColleges.includes("tabletop") && (
            <button type="button" className="overview-card" onClick={() => onOpenCollege("tabletop")}>
              <span className="overview-card__icon"><CollegeIcon collegeId="tabletop" size={22} /></span>
              <span className="overview-card__label">Tabletop</span>
              {status === "loading" ? (
                <span className="overview-card__value">…</span>
              ) : tabletopCount ? (
                <>
                  <span className="overview-card__value">{tabletopCount}</span>
                  <span className="overview-card__unit">campaigns &amp; armies</span>
                </>
              ) : (
                <span className="overview-card__empty">Nothing yet — start a campaign or army</span>
              )}
            </button>
          )}

          {NOT_BUILT_COLLEGES.filter((c) => selectedColleges.includes(c.id)).map((college) => (
            <div key={college.id} className="overview-card overview-card--disabled">
              <span className="overview-card__icon">{college.icon}</span>
              <span className="overview-card__label">{college.label}</span>
              <span className="overview-card__lock" aria-hidden="true">🔒</span>
              <span className="overview-card__empty">Coming soon</span>
            </div>
          ))}
        </HorizontalLane>
      )}
    </div>
  );
}
