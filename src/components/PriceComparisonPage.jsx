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
import { importSteamWishlist } from "../lib/wishlistImport";
import { getExchangeRates, SUPPORTED_CURRENCIES, formatPrice } from "../lib/currency";
import { getCheapestInfo } from "./price/priceUtils";
import WishlistCard from "./price/WishlistCard";
import PriceSearch from "./price/PriceSearch";

export default function PriceComparisonPage({
  wishlist,
  onAddToWishlist,
  onRemoveFromWishlist,
  onOpenHypeCharts,
  onOpenMarket,
  onOpenSales,
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
  const [saleOnly, setSaleOnly] = useState(false);
  const [preorderOnly, setPreorderOnly] = useState(false);
  const [resyncStatus, setResyncStatus] = useState("idle");
  const [resyncMessage, setResyncMessage] = useState("");

  // ---------- exchange rates (once) ----------
  useEffect(() => {
    getExchangeRates().then(setRates);
  }, []);

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
            [title]: "Not found on CheapShark",
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
            if (result === "no_key") return;
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
          if (result === "no_key") return;
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

  // ---------- Steam wishlist resync ----------
  async function handleResync() {
    if (!linkedSteamId) return;
    setResyncStatus("loading");
    setResyncMessage("");

    try {
      const { total, added } = await importSteamWishlist(
        linkedSteamId,
        onAddToWishlist,
        (current, totalCount) =>
          setResyncMessage(`Syncing… ${current} of ${totalCount}`)
      );
      setResyncStatus("done");
      setResyncMessage(`Synced — ${added} of ${total} games up to date.`);
    } catch (err) {
      console.error("Steam resync failed:", err);
      setResyncStatus("error");
      setResyncMessage(
        "Couldn't resync right now — make sure your wishlist is still set to public on Steam."
      );
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

  // Both filters are independent and combine as AND — checking both
  // shows only unreleased games currently on presale/discount, not
  // "either one." comingSoon is real Steam data (release_date.coming_soon),
  // already fetched into metaByTitle for every wishlist item via
  // resolveGameName — not a guess or a date-math heuristic.
  const visibleWishlist = sortedWishlist.filter((entry) => {
    if (saleOnly) {
      const info = getCheapestInfo(
        dealsByTitle[entry.title],
        metaByTitle[entry.title],
        rates
      );
      if (!info || info.rrp <= info.price) return false;
    }
    if (preorderOnly && !metaByTitle[entry.title]?.comingSoon) return false;
    return true;
  });

  // Real stat summary — same getCheapestInfo already trusted for the
  // "On sale only" filter, not a separate/different calculation that
  // could drift out of sync with it. Each entry's cheapest price can
  // be natively AUD or USD depending on which store won — converting
  // every entry to a single currency (AUD) before summing, rather
  // than adding raw numbers across mismatched currencies, which
  // would silently produce a meaningless total.
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

  // ---------- render ----------
  return (
    <div className="price-page">
      <div className="price-page__head">
        <div className="price-page__head-row">
          <div>
            <h1 className="price-page__title">Store Tracker</h1>
            <p className="price-page__subtitle">
              Your wishlist, newest additions first.
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

      {linkedSteamId && (
        <div className="steam-sync-row">
          <button
            type="button"
            className="steam-sync-btn"
            onClick={handleResync}
            disabled={resyncStatus === "loading"}
            title="Resync your Steam wishlist"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-2.34-5.66L15 9V3H9l2.3 2.3A9.96 9.96 0 0 0 12 2z" />
            </svg>
            {resyncStatus === "loading" ? "Syncing…" : "Resync Steam wishlist"}
          </button>
          {resyncMessage && (
            <span
              className={`panel__status ${
                resyncStatus === "error" ? "panel__status--error" : ""
              }`}
            >
              {resyncMessage}
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

      <div className="wishlist-sort-row">
        <span className="feed-col__label">
          Your wishlist
          <span className="feed-col__count">
            {visibleWishlist.length}
            {saleOnly && preorderOnly
              ? " on sale · preorder"
              : saleOnly
              ? " on sale"
              : preorderOnly
              ? " preorder"
              : ""}
          </span>
        </span>
        <div className="wishlist-sort-row__controls">
          <label className="wishlist-filter-toggle">
            <input
              type="checkbox"
              checked={saleOnly}
              onChange={(e) => setSaleOnly(e.target.checked)}
            />
            <span>On sale only</span>
          </label>
          <label className="wishlist-filter-toggle">
            <input
              type="checkbox"
              checked={preorderOnly}
              onChange={(e) => setPreorderOnly(e.target.checked)}
            />
            <span>Preorders only</span>
          </label>
          <label className="wishlist-sort-row__control">
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
        </div>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Your wishlist is a void.</p>
          <p className="empty-state__body">
            Search above and start tracking prices. Future-you will thank present-you
            when something finally drops.
          </p>
        </div>
      ) : visibleWishlist.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">
            {saleOnly && preorderOnly
              ? "Nothing unreleased and on sale right now."
              : preorderOnly
              ? "No preorders in your wishlist right now."
              : "Nothing on sale right now."}
          </p>
          <p className="empty-state__body">
            {preorderOnly
              ? "Turn off the filters above to see the full list, or check back once something new gets announced."
              : "Turn off \"On sale only\" to see the full list, or wait for the next wave of discounts."}
          </p>
          <button
            type="button"
            className="current-rotation__btn"
            onClick={() => {
              setSaleOnly(false);
              setPreorderOnly(false);
            }}
          >
            Show everything
          </button>
        </div>
      ) : (
        <ul className="wishlist-list">
          {visibleWishlist.map((entry) => (
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
    </div>
  );
}
