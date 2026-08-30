// Overview — cross-College summary. Every card shows a real number or
// an honest empty state — never a fabricated one.

import { useEffect, useState } from "react";
import { fetchOwnedGames } from "../lib/steam";
import { fetchCollection } from "../lib/mtg";
import { fetchEntertainmentEntries } from "../lib/entertainment";
import { fetchCollectibles } from "../lib/collectibles";
import { fetchCampaigns, fetchArmies } from "../lib/tabletop";
import { fetchRecentActivityForUser, describeActivity } from "../lib/guilds";
import SteamPresenceCard from "./SteamPresenceCard";
import OverviewStockChart from "./OverviewStockChart";
import GuildPulseCard from "./GuildPulseCard";
import CollegeMorphHero from "./CollegeMorphHero";
import HorizontalLane from "./mobile/HorizontalLane";

const TITLE_CYCLE_MS = 3200;
const TITLE_PRIMARY = ["Five Colleges.", "Your Infinities."];
const TITLE_GHOST = ["One vault.", "Lykodex"];

function OverviewCommandTitle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let timer = null;

    function apply() {
      if (timer) clearInterval(timer);
      timer = null;
      if (query?.matches) {
        setIndex(0);
        return;
      }
      timer = setInterval(() => setIndex((i) => (i + 1) % TITLE_PRIMARY.length), TITLE_CYCLE_MS);
    }

    apply();
    query?.addEventListener("change", apply);
    return () => {
      if (timer) clearInterval(timer);
      query?.removeEventListener("change", apply);
    };
  }, []);

  return (
    <h1 className="overview-command__title">
      <span className="overview-command__title-line overview-command__title-line--cycle">
        {TITLE_PRIMARY.map((phrase, i) => (
          <span
            key={phrase}
            className={`overview-command__title-cycle-word ${i === index ? "overview-command__title-cycle-word--active" : ""}`}
          >
            {phrase}
          </span>
        ))}
      </span>
      <span className="overview-command__title-line overview-command__title-line--ghost overview-command__title-line--cycle">
        {TITLE_GHOST.map((phrase, i) => (
          <span
            key={phrase}
            className={`overview-command__title-cycle-word ${i === index ? "overview-command__title-cycle-word--active" : ""}`}
          >
            {phrase}
          </span>
        ))}
      </span>
    </h1>
  );
}

// Animates 0 -> target once real data is in. Skips under reduced-motion.
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

  const heroSlides = [
    { key: "total", accent: "vault", label: "Your collection", value: totalCollected, unit: "pieces collected across your Colleges" },
    showGaming && gameCount !== null && { key: "gaming", accent: "gaming", label: "Gaming library", value: gameCount, unit: "games in your library" },
    showTcg && cardCount !== null && { key: "tcg", accent: "tcg", label: "TCG collection", value: cardCount, unit: "cards collected" },
    selectedColleges.includes("entertainment") && entertainmentCount !== null && { key: "entertainment", accent: "entertainment", label: "Library", value: entertainmentCount, unit: "movies, shows, anime & books tracked" },
    selectedColleges.includes("collectibles") && collectiblesCount !== null && { key: "collectibles", accent: "collectibles", label: "Loot", value: collectiblesCount, unit: "items on your shelf" },
    selectedColleges.includes("tabletop") && tabletopCount !== null && { key: "tabletop", accent: "tabletop", label: "Wartable", value: tabletopCount, unit: "campaigns & armies" },
  ].filter(Boolean);

  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!heroReady || paused || heroSlides.length < 2) return;
    const timer = setInterval(() => {
      setSlideIndex((i) => (i + 1) % heroSlides.length);
    }, 4200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroReady, paused, heroSlides.length]);

  const currentSlide = heroSlides[slideIndex % heroSlides.length] || heroSlides[0];
  const animatedValue = useCountUp(currentSlide?.value ?? 0, heroReady);
  const morphFocusCollege = currentSlide?.accent && currentSlide.accent !== "vault" ? currentSlide.accent : null;
  const activeCollegeId = heroReady ? morphFocusCollege : null;

  function openActiveCollege() {
    if (activeCollegeId) onOpenCollege(activeCollegeId);
  }

  return (
    <div className="overview-page">
      <section className="overview-command" aria-label="Vault summary">
        <CollegeMorphHero
          focusCollegeId={morphFocusCollege}
          className="college-morph-hero--command-stage"
        />
        <div
          className={`overview-command__grid${activeCollegeId ? " overview-command__grid--nav" : ""}`}
          data-college={activeCollegeId || undefined}
          role={activeCollegeId ? "button" : undefined}
          tabIndex={activeCollegeId ? 0 : undefined}
          aria-label={activeCollegeId ? `Open ${currentSlide.label}` : undefined}
          onClick={activeCollegeId ? openActiveCollege : undefined}
          onKeyDown={
            activeCollegeId
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openActiveCollege();
                  }
                }
              : undefined
          }
        >
          <div className="overview-command__copy">
            <span className="overview-command__eyebrow">Collection command</span>
            <OverviewCommandTitle />
            <p className="overview-command__subtitle">What&apos;s actually going on across your Colleges.</p>

            {heroReady && currentSlide ? (
              <div
                className="overview-hero overview-hero--embedded"
                data-accent={currentSlide.accent}
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
                        data-accent={slide.accent}
                        className={`hero-card__dot ${i === slideIndex ? "hero-card__dot--active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideIndex(i);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : isLoggedIn && status === "loading" ? (
              <div className="overview-stat-skeleton" aria-busy="true" aria-label="Loading collection counts">
                <span className="overview-stat-skeleton__eyebrow" />
                <span className="overview-stat-skeleton__number" />
                <span className="overview-stat-skeleton__unit" />
              </div>
            ) : isLoggedIn && status === "error" ? (
              <p className="overview-command__hint overview-command__hint--error">
                Couldn&apos;t load your counts right now — try refreshing.
              </p>
            ) : (
              <p className="overview-command__hint">
                Sign in from the header to see live collection counts rotate here — real numbers from your Colleges, nothing fabricated.
              </p>
            )}
          </div>

          <div className="overview-command__visual" aria-hidden="true" />
        </div>

        {tickerActivity.length > 0 && (
          <div className="overview-ticker overview-ticker--inset">
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
      </section>

      {isLoggedIn && (
        <section className="overview-section" aria-label="Right now">
          <p className="overview-section__eyebrow">Right now</p>
          <HorizontalLane className="overview-lane">
            {showGaming && (
              <div className="overview-tile overview-tile--steam">
                <div className="overview-tile__stack">
                  <SteamPresenceCard userId={userId} linkedSteamId={linkedSteamId} />
                  <OverviewStockChart
                    userId={userId}
                    linkedSteamId={linkedSteamId}
                  />
                </div>
              </div>
            )}
            <div className="overview-tile overview-tile--guild">
              <GuildPulseCard userId={userId} onGoToGuilds={onGoToGuilds} />
            </div>
          </HorizontalLane>
        </section>
      )}
    </div>
  );
}
