/**
 * Store Tracker / Price Comparison — orchestrator.
 *
 * Heavy UI pieces live under ./price/:
 *   priceUtils.js   — pure helpers + constants
 *   StoreChip.jsx   — individual store price chips
 *   WishlistCard.jsx
 *   PriceSearch.jsx — search bar, suggestions, result cards
 *
 * This file owns page-level state (deals, meta, rates, sort, resync)
 * and composes the pieces above.
 */

import { useEffect, useState } from "react";
import { fetchGameDeal } from "../lib/gameData";
import { fetchXboxPrice } from "../lib/xbxprices";
import { fetchPSPrice } from "../lib/platprices";
import {
  fetchCurrentPlayers,
  resolveGameName,
  fetchReviewSummary,
} from "../lib/steam";
import { importSteamWishlist, importXboxWishlist, importPsnWishlist } from "../lib/wishlistImport";
import { fetchLiveGamerscore } from "../lib/xboxOAuth";
import { fetchLiveTrophies } from "../lib/psnAuth";
import { getExchangeRates, SUPPORTED_CURRENCIES, formatPrice } from "../lib/currency";
import { getCheapestInfo, categorizeWishlistEntry } from "./price/priceUtils";
import WishlistCard from "./price/WishlistCard";
import PriceSearch from "./price/PriceSearch";
import ReleaseCalendarCard from "./ReleaseCalendarCard";

const WISHLIST_COLUMNS = [
  { id: "onSale", label: "On sale", blurb: "Dropping now", accent: "teal" },
  { id: "preorder", label: "Preorders", blurb: "Coming soon", accent: "amber" },
  { id: "games", label: "Games", blurb: "Full titles", accent: "sky" },
  { id: "dlc", label: "DLC", blurb: "Add-ons & expansions", accent: "rose" },
];

const WISHLIST_SYNC_PLATFORMS = [
  { id: "steam", label: "Steam", resyncLabel: "Resync Steam wishlist", title: "Resync your Steam wishlist" },
  { id: "xbox", label: "Xbox", resyncLabel: "Resync Xbox wishlist", title: "Resync your Xbox wishlist" },
  { id: "playstation", label: "PlayStation", resyncLabel: "Resync PSN wishlist", title: "Resync your PlayStation wishlist" },
];

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-2.34-5.66L15 9V3H9l2.3 2.3A9.96 9.96 0 0 0 12 2z" />
    </svg>
  );
}

export default function PriceComparisonPage({
  wishlist,
  onAddToWishlist,
  onRemoveFromWishlist,
  onOpenHypeCharts,
  onOpenMarket,
  onOpenSales,
  onOpenCalendar,
  isLoggedIn,
  onSignIn,
  onCreateAccount,
  linkedSteamId,
  currency,
  onCurrencyChange,
  platformOrder,
}) {
  const [dealsByTitle, setDealsByTitle] = useState({});
  const [playersByTitle, setPlayersByTitle] = useState({});
  const [metaByTitle, setMetaByTitle] = useState({});
  const [rates, setRates] = useState(null);
  const [errorByTitle, setErrorByTitle] = useState({});
  const [sortBy, setSortBy] = useState("newest");
  const [platformLinked, setPlatformLinked] = useState({
    steam: false,
    xbox: false,
    playstation: false,
  });
  const [syncState, setSyncState] = useState({
    steam: { status: "idle", message: "" },
    xbox: { status: "idle", message: "" },
    playstation: { status: "idle", message: "" },
  });

  // ---------- exchange rates (once) ----------
  useEffect(() => {
    getExchangeRates().then(setRates);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setPlatformLinked({ steam: false, xbox: false, playstation: false });
      return;
    }

    setPlatformLinked((prev) => ({ ...prev, steam: Boolean(linkedSteamId) }));

    Promise.allSettled([fetchLiveGamerscore(), fetchLiveTrophies()])
      .then(([xboxResult, psnResult]) => {
        setPlatformLinked({
          steam: Boolean(linkedSteamId),
          xbox: xboxResult.status === "fulfilled",
          playstation: psnResult.status === "fulfilled",
        });
      });
  }, [isLoggedIn, linkedSteamId]);

  // ---------- load deals for wishlist entries ----------
  function loadDealForTitle(title) {
    setErrorByTitle((prev) => {
      const next = { ...prev };
      delete next[title];
      return next;
    });

    fetchGameDeal(title)
      .then((deal) => {
        if (!deal) {
          setErrorByTitle((prev) => ({
            ...prev,
            [title]: "Not found",
          }));
          return;
        }
        setDealsByTitle((prev) => ({ ...prev, [title]: deal }));

        if (deal.steamAppID) {
          fetchCurrentPlayers(deal.steamAppID)
            .then((count) =>
              setPlayersByTitle((prev) => ({ ...prev, [title]: count }))
            )
            .catch(() => {});

          resolveGameName(deal.steamAppID)
            .then((info) =>
              setMetaByTitle((prev) => ({
                ...prev,
                [title]: { ...prev[title], ...info },
              }))
            )
            .catch(() => {});

          fetchReviewSummary(deal.steamAppID)
            .then((reviews) =>
              setMetaByTitle((prev) => ({
                ...prev,
                [title]: { ...prev[title], ...reviews },
              }))
            )
            .catch(() => {});
        }

        fetchXboxPrice(deal.game)
          .then((result) => {
            if (result === "no_key") return;
            setMetaByTitle((prev) => ({
              ...prev,
              [title]: {
                ...prev[title],
                xboxChecked: true,
                xboxAuPrice: result?.price ?? null,
                xboxAuRrp: result?.rrp ?? null,
                xboxProductId: result?.xboxProductId ?? null,
              },
            }));
          })
          .catch((err) => console.error("Xbox price fetch failed:", err));

        fetchPSPrice(deal.game)
          .then((result) => {
            if (result === "no_key") {
              setMetaByTitle((prev) => ({ ...prev, [title]: { ...prev[title], psNoKey: true } }));
              return;
            }
            setMetaByTitle((prev) => ({
              ...prev,
              [title]: {
                ...prev[title],
                psChecked: true,
                psAuPrice: result?.price ?? null,
                psAuRrp: result?.rrp ?? null,
              },
            }));
          })
          .catch((err) => console.error("PlayStation price fetch failed:", err));
      })
      .catch((err) => {
        console.error("Wishlist lookup failed:", err);
        setErrorByTitle((prev) => ({
          ...prev,
          [title]: err.message || "Couldn't load this game",
        }));
      });
  }

  useEffect(() => {
    wishlist.forEach((entry) => {
      if (dealsByTitle[entry.title] || errorByTitle[entry.title]) return;
      loadDealForTitle(entry.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist]);

  // ---------- enrich search results with the same meta path ----------
  function enrichSearchResults(deals) {
    deals.forEach((deal) => {
      if (!deal.steamAppID) return;
      const title = deal.game;

      resolveGameName(deal.steamAppID)
        .then((info) =>
          setMetaByTitle((prev) => ({
            ...prev,
            [title]: { ...prev[title], ...info },
          }))
        )
        .catch((err) =>
          console.error(`Steam info fetch failed for "${title}":`, err)
        );

      fetchXboxPrice(deal.game)
        .then((result) => {
          if (result === "no_key") return;
          setMetaByTitle((prev) => ({
            ...prev,
            [title]: {
              ...prev[title],
              xboxChecked: true,
              xboxAuPrice: result?.price ?? null,
              xboxAuRrp: result?.rrp ?? null,
              xboxProductId: result?.xboxProductId ?? null,
            },
          }));
        })
        .catch((err) =>
          console.error(`Xbox price fetch failed for "${title}":`, err)
        );

      fetchPSPrice(deal.game)
        .then((result) => {
          if (result === "no_key") {
            setMetaByTitle((prev) => ({ ...prev, [title]: { ...prev[title], psNoKey: true } }));
            return;
          }
          setMetaByTitle((prev) => ({
            ...prev,
            [title]: {
              ...prev[title],
              psChecked: true,
              psAuPrice: result?.price ?? null,
              psAuRrp: result?.rrp ?? null,
            },
          }));
        })
        .catch((err) =>
          console.error(`PlayStation price fetch failed for "${title}":`, err)
        );
    });
  }

  // ---------- platform wishlist resync ----------
  const anySyncLoading = WISHLIST_SYNC_PLATFORMS.some(
    (platform) => syncState[platform.id]?.status === "loading"
  );
  const activeSyncMessage = WISHLIST_SYNC_PLATFORMS.map((platform) => syncState[platform.id])
    .find((state) => state?.message)?.message || "";
  const activeSyncError = WISHLIST_SYNC_PLATFORMS.some(
    (platform) => syncState[platform.id]?.status === "error"
  );

  async function handleResync(platformId) {
    if (!platformLinked[platformId]) return;

    setSyncState((prev) => ({
      ...prev,
      [platformId]: { status: "loading", message: "" },
    }));

    const onProgress = (current, totalCount) => {
      setSyncState((prev) => ({
        ...prev,
        [platformId]: { ...prev[platformId], message: `Syncing… ${current} of ${totalCount}` },
      }));
    };

    try {
      let total;
      let added;

      if (platformId === "steam") {
        ({ total, added } = await importSteamWishlist(linkedSteamId, onAddToWishlist, onProgress));
      } else if (platformId === "xbox") {
        ({ total, added } = await importXboxWishlist(onAddToWishlist, onProgress));
      } else {
        ({ total, added } = await importPsnWishlist(onAddToWishlist, onProgress));
      }

      setSyncState((prev) => ({
        ...prev,
        [platformId]: {
          status: "done",
          message: `Synced — ${added} of ${total} games up to date.`,
        },
      }));
    } catch (err) {
      console.error(`${platformId} wishlist resync failed:`, err);
      const fallback = platformId === "steam"
        ? "Couldn't resync right now — make sure your wishlist is still set to public on Steam."
        : platformId === "xbox"
          ? "Xbox wishlist sync isn't available yet — Microsoft doesn't expose wishlist data through the linked-account API."
          : "Couldn't resync your PlayStation wishlist right now — try re-linking on Account Linking.";
      setSyncState((prev) => ({
        ...prev,
        [platformId]: { status: "error", message: err.message || fallback },
      }));
    }
  }

  // ---------- sort ----------
  function sortWishlist(list) {
    const withData = (title) => ({
      deal: dealsByTitle[title],
      meta: metaByTitle[title],
    });

    switch (sortBy) {
      case "name":
        return [...list].sort((a, b) => a.title.localeCompare(b.title));

      case "releaseDate":
        return [...list].sort((a, b) => {
          const aDate = withData(a.title).meta?.releaseDate;
          const bDate = withData(b.title).meta?.releaseDate;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate) - new Date(aDate);
        });

      case "priceHigh":
      case "priceLow": {
        return [...list].sort((a, b) => {
          const aInfo = getCheapestInfo(
            withData(a.title).deal,
            withData(a.title).meta,
            rates
          );
          const bInfo = getCheapestInfo(
            withData(b.title).deal,
            withData(b.title).meta,
            rates
          );
          if (!aInfo && !bInfo) return 0;
          if (!aInfo) return 1;
          if (!bInfo) return -1;
          const aAud =
            aInfo.nativeCurrency === "AUD"
              ? aInfo.price
              : aInfo.price * (rates?.AUD ?? 1);
          const bAud =
            bInfo.nativeCurrency === "AUD"
              ? bInfo.price
              : bInfo.price * (rates?.AUD ?? 1);
          return sortBy === "priceHigh" ? bAud - aAud : aAud - bAud;
        });
      }

      case "discount":
        return [...list].sort((a, b) => {
          const aInfo = getCheapestInfo(
            withData(a.title).deal,
            withData(a.title).meta,
            rates
          );
          const bInfo = getCheapestInfo(
            withData(b.title).deal,
            withData(b.title).meta,
            rates
          );
          const aPct =
            aInfo?.rrp > aInfo?.price ? (1 - aInfo.price / aInfo.rrp) * 100 : -1;
          const bPct =
            bInfo?.rrp > bInfo?.price ? (1 - bInfo.price / bInfo.rrp) * 100 : -1;
          return bPct - aPct;
        });

      case "newest":
      default:
        return [...list].sort(
          (a, b) => new Date(b.addedAt) - new Date(a.addedAt)
        );
    }
  }

  const sortedWishlist = sortWishlist(wishlist);

  // Real stat summary — same getCheapestInfo/categorizeWishlistEntry
  // already trusted for the column split below, not a separate
  // calculation that could drift out of sync with it. Each entry's
  // cheapest price can be natively AUD or USD depending on which store
  // won — converting every entry to a single currency (AUD) before
  // summing, rather than adding raw numbers across mismatched
  // currencies, which would silently produce a meaningless total.
  let onSaleCount = 0;
  let totalEstimatedValueAud = 0;
  for (const entry of wishlist) {
    const info = getCheapestInfo(dealsByTitle[entry.title], metaByTitle[entry.title], rates);
    if (info && rates) {
      const audEquivalent = info.nativeCurrency === "AUD" ? info.price : info.price * rates.AUD;
      totalEstimatedValueAud += audEquivalent || 0;
      if (info.rrp > info.price) onSaleCount += 1;
    }
  }

  // Every entry lands in exactly one of the 4 columns — see
  // categorizeWishlistEntry for the real signals + precedence order.
  // Entries whose deal hasn't loaded yet (still fetching, or errored)
  // are shown separately above the columns rather than guessed into one.
  const pendingEntries = sortedWishlist.filter((entry) => !dealsByTitle[entry.title]);
  const readyEntries = sortedWishlist.filter((entry) => dealsByTitle[entry.title]);

  const columns = WISHLIST_COLUMNS.map((col) => {
    const items = readyEntries.filter(
      (entry) => categorizeWishlistEntry(dealsByTitle[entry.title], metaByTitle[entry.title], rates) === col.id
    );
    let valueAud = 0;
    items.forEach((entry) => {
      const info = getCheapestInfo(dealsByTitle[entry.title], metaByTitle[entry.title], rates);
      if (info && rates) {
        valueAud += info.nativeCurrency === "AUD" ? info.price : info.price * rates.AUD;
      }
    });
    return { ...col, items, valueAud };
  });

  // ---------- render ----------
  return (
    <div className="price-page">
      <div className="price-page__head">
        <div className="price-page__head-row">
          <div>
            <h1 className="price-page__title">Market</h1>
            <p className="price-page__subtitle">
              Your wishlist, real prices across stores, and what's launching next.
            </p>
          </div>
          {onCurrencyChange && (
            <label className="currency-picker">
              <span>Currency</span>
              <select
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {wishlist.length > 0 && (
        <div className="backlog-summary">
          <div className="panel__stat">
            <span className="panel__stat-value">{wishlist.length}</span>
            <span className="panel__stat-label">Wishlist items</span>
          </div>
          <div className="panel__stat">
            <span className="panel__stat-value">{onSaleCount}</span>
            <span className="panel__stat-label">On sale now</span>
          </div>
          {rates && (
            <div className="panel__stat">
              <span className="panel__stat-value">
                {formatPrice(totalEstimatedValueAud, "AUD", rates, currency)}
              </span>
              <span className="panel__stat-label">Est. total (cheapest each)</span>
            </div>
          )}
        </div>
      )}

      <div className="price-nav-row">
        {onOpenSales && (
          <button type="button" className="price-nav-card" onClick={onOpenSales}>
            <span className="price-nav-card__title">Current Sales</span>
            <span className="price-nav-card__subtitle">
              Store-wide events happening now
            </span>
          </button>
        )}
        {onOpenHypeCharts && (
          <button
            type="button"
            className="price-nav-card"
            onClick={onOpenHypeCharts}
          >
            <span className="price-nav-card__title">Hype Charts</span>
            <span className="price-nav-card__subtitle">
              Top played games right now
            </span>
          </button>
        )}
        {onOpenMarket && (
          <button
            type="button"
            className="price-nav-card"
            onClick={onOpenMarket}
          >
            <span className="price-nav-card__title">In Game Stores</span>
            <span className="price-nav-card__subtitle">
              Live rotating shops — Fortnite, Marvel Rivals & more
            </span>
          </button>
        )}
      </div>

      <ReleaseCalendarCard
        wishlist={wishlist}
        linkedSteamId={linkedSteamId}
        onOpenCalendar={onOpenCalendar}
      />

      {isLoggedIn && (
        <div className="steam-sync-row">
          {WISHLIST_SYNC_PLATFORMS.map((platform) => {
            const state = syncState[platform.id];
            const linked = platformLinked[platform.id];
            return (
              <button
                key={platform.id}
                type="button"
                className="steam-sync-btn"
                onClick={() => handleResync(platform.id)}
                disabled={!linked || anySyncLoading}
                title={linked ? platform.title : `Link ${platform.label} on Account Linking first`}
              >
                <SyncIcon />
                {state?.status === "loading" ? "Syncing…" : platform.resyncLabel}
              </button>
            );
          })}
          {activeSyncMessage && (
            <span
              className={`panel__status ${
                activeSyncError ? "panel__status--error" : ""
              }`}
            >
              {activeSyncMessage}
            </span>
          )}
        </div>
      )}

      <PriceSearch
        wishlist={wishlist}
        onAddToWishlist={onAddToWishlist}
        onRemoveFromWishlist={onRemoveFromWishlist}
        isLoggedIn={isLoggedIn}
        onSignIn={onSignIn}
        onCreateAccount={onCreateAccount}
        currency={currency}
        rates={rates}
        platformOrder={platformOrder}
        metaByTitle={metaByTitle}
        onEnrich={enrichSearchResults}
      />

      <section className="market-wishlist" aria-labelledby="market-wishlist-heading">
        <header className="market-wishlist__header">
          <div className="market-wishlist__intro">
            <h2 id="market-wishlist-heading" className="market-wishlist__title">Your wishlist</h2>
            <p className="market-wishlist__subtitle">
              {wishlist.length === 0
                ? "Search above to start tracking prices."
                : `${wishlist.length} title${wishlist.length === 1 ? "" : "s"} · ${onSaleCount} on sale right now`}
            </p>
          </div>
          <label className="market-wishlist__sort wishlist-sort-row__control">
            <span>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Recently added</option>
              <option value="name">Name (A–Z)</option>
              <option value="releaseDate">Release date</option>
              <option value="priceHigh">Price: high to low</option>
              <option value="priceLow">Price: low to high</option>
              <option value="discount">Discount %</option>
            </select>
          </label>
        </header>

        {wishlist.length === 0 ? (
          <div className="market-wishlist__empty empty-state">
            <p className="empty-state__title">Your wishlist is a void.</p>
            <p className="empty-state__body">
              Search above and start tracking prices. Future-you will thank present-you
              when something finally drops.
            </p>
          </div>
        ) : (
          <>
            {pendingEntries.length > 0 && (
              <div className="market-wishlist__pending">
                <span className="market-wishlist__pending-label">Still loading prices</span>
                <ul className="wishlist-list wishlist-list--pending">
                  {pendingEntries.map((entry) => (
                    <WishlistCard
                      key={entry.id}
                      entry={entry}
                      deal={dealsByTitle[entry.title]}
                      players={playersByTitle[entry.title]}
                      meta={metaByTitle[entry.title]}
                      rates={rates}
                      currency={currency}
                      onRemove={onRemoveFromWishlist}
                      error={errorByTitle[entry.title]}
                      onRetry={loadDealForTitle}
                      isLoggedIn={isLoggedIn}
                      onSignIn={onSignIn}
                      onCreateAccount={onCreateAccount}
                      platformOrder={platformOrder}
                    />
                  ))}
                </ul>
              </div>
            )}

            <div className="wishlist-columns">
              {columns.map((col) => {
                const columnDef = WISHLIST_COLUMNS.find((c) => c.id === col.id);
                return (
                  <section
                    key={col.id}
                    className={`wishlist-column wishlist-column--${col.id}`}
                    data-accent={columnDef?.accent}
                  >
                    <header className="wishlist-column__head">
                      <div className="wishlist-column__head-top">
                        <span className="wishlist-column__eyebrow">{columnDef?.blurb}</span>
                        <span className="wishlist-column__count">{col.items.length}</span>
                      </div>
                      <div className="wishlist-column__head-bottom">
                        <span className="wishlist-column__label">{columnDef?.label || col.label}</span>
                        {rates && col.items.length > 0 && (
                          <span className="wishlist-column__value">
                            {formatPrice(col.valueAud, "AUD", rates, currency)}
                          </span>
                        )}
                      </div>
                    </header>

                    {col.items.length === 0 ? (
                      <p className="wishlist-column__empty">Nothing here yet.</p>
                    ) : (
                      <ul className="wishlist-list">
                        {col.items.map((entry) => (
                          <WishlistCard
                            key={entry.id}
                            entry={entry}
                            deal={dealsByTitle[entry.title]}
                            players={playersByTitle[entry.title]}
                            meta={metaByTitle[entry.title]}
                            rates={rates}
                            currency={currency}
                            onRemove={onRemoveFromWishlist}
                            error={errorByTitle[entry.title]}
                            onRetry={loadDealForTitle}
                            isLoggedIn={isLoggedIn}
                            onSignIn={onSignIn}
                            onCreateAccount={onCreateAccount}
                            platformOrder={platformOrder}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
