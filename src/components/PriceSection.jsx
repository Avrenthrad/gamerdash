// Section 1: Price Comparison — Quickdash preview.
// Shows a small sample of the wishlist (newest 2 adds) so this stays
// a quick glance, not the full experience. Clicking anywhere on the
// card opens the dedicated Price Comparison page (see
// PriceComparisonPage.jsx) with the full wishlist, search, and the
// per-store cascade.
//
// Currency follows the site-wide selection (lifted to App.jsx) — this
// preview always shows CheapShark's raw cheapest-store price (USD
// native), it doesn't do the "prefer Steam's real regional price"
// logic the full page does, so it's treated as USD-native here.

import { useEffect, useState } from "react";
import { fetchGameDeal } from "../lib/gameData";
import { getExchangeRates, formatPrice } from "../lib/currency";

export default function PriceSection({ wishlist, onOpenFullPage, currency }) {
  const [dealsByTitle, setDealsByTitle] = useState({});
  const [rates, setRates] = useState(null);

  const preview = [...wishlist]
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 3);

  useEffect(() => {
    getExchangeRates().then(setRates);
  }, []);

  useEffect(() => {
    let cancelled = false;
    preview.forEach((entry) => {
      if (dealsByTitle[entry.title]) return;
      fetchGameDeal(entry.title)
        .then((deal) => {
          if (!cancelled && deal) {
            setDealsByTitle((prev) => ({ ...prev, [entry.title]: deal }));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist]);

  return (
    <section id="prices" className="panel panel--teal">
      <button type="button" className="panel-preview-trigger" onClick={onOpenFullPage}>
        <div className="panel__head">
          <h2 className="panel__title">Store Tracker</h2>
          <p className="panel__subtitle">From your wishlist — tap to see the full picture.</p>
        </div>

        {preview.length === 0 ? (
          <div className="panel-empty">
            <p>Wishlist is empty. Track a few games and price drops will show up here.</p>
          </div>
        ) : (
          <ul className="wishlist-preview-list">
            {preview.map((entry) => {
              const deal = dealsByTitle[entry.title];
              return (
                <li key={entry.id} className="wishlist-preview-row">
                  {deal?.thumb ? (
                    <img src={deal.thumb} alt="" className="wishlist-preview-row__thumb" />
                  ) : (
                    <div className="wishlist-preview-row__thumb wishlist-preview-row__thumb--placeholder" />
                  )}
                  <span className="wishlist-preview-row__title">{entry.title}</span>
                  {deal?.stores[0] && (
                    <span className="wishlist-preview-row__price">
                      {formatPrice(deal.stores[0].price, "USD", rates, currency)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <span className="panel-preview-trigger__cta">
          {preview.length === 0 ? "Open Store Tracker →" : "View full wishlist →"}
        </span>
      </button>
    </section>
  );
}
