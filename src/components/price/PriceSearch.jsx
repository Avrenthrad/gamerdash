import { useRef, useState } from "react";
import { formatPrice } from "../../lib/currency";
import { searchSteamGames } from "../../lib/steam";
import { fetchGameDeals } from "../../lib/gameData";
import WishlistToggle from "../WishlistToggle";
import { StoreChip } from "./StoreChip";
import { buildStoreRow, getCheapestInfo } from "./priceUtils";

/**
 * Search bar, typeahead suggestions, and search-result cards.
 * Parent owns the heavier enrichment (Xbox/PS/Steam meta) via
 * onResults + enrichSearchResults so the wishlist cards and search
 * cards share the same metaByTitle cache.
 */
export default function PriceSearch({
  wishlist,
  onAddToWishlist,
  onRemoveFromWishlist,
  isLoggedIn,
  onSignIn,
  onCreateAccount,
  currency,
  rates,
  platformOrder,
  metaByTitle,
  onResults,
  onEnrich,
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchStatus, setSearchStatus] = useState("idle"); // idle | loading | done | error
  const [searchResults, setSearchResults] = useState([]);
  const debounceRef = useRef(null);

  function handleQueryChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchSteamGames(value.trim())
        .then((matches) => {
          setSuggestions(matches.slice(0, 6));
          setShowSuggestions(true);
        })
        .catch(() => {});
    }, 300);
  }

  async function runSearch(title) {
    setShowSuggestions(false);
    setSearchStatus("loading");
    setSearchResults([]);
    try {
      const deals = await fetchGameDeals(title, 6);
      setSearchResults(deals);
      setSearchStatus(deals.length > 0 ? "done" : "error");
      onResults?.(deals);
      onEnrich?.(deals);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchStatus("error");
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(query.trim());
  }

  function handleSuggestionClick(title) {
    setQuery(title);
    runSearch(title);
  }

  function handleClear() {
    setSearchResults([]);
    setSearchStatus("idle");
    setQuery("");
  }

  return (
    <>
      <form className="price-search" onSubmit={handleSearch}>
        <div className="price-search__input-wrap">
          <input
            className="price-search__input"
            type="text"
            placeholder="Search for a game or DLC to add…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul className="search-suggestions">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="search-suggestions__item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(s.name)}
                  >
                    {s.tiny_image ? (
                      <img
                        src={s.tiny_image}
                        alt=""
                        className="search-suggestions__thumb"
                        decoding="async"
                      />
                    ) : (
                      <div className="search-suggestions__thumb search-suggestions__thumb--placeholder" />
                    )}
                    <span className="search-suggestions__title">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="price-search__button">
          Search
        </button>
        {searchResults.length > 0 && (
          <button type="button" className="price-search__clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </form>

      {searchStatus === "loading" && <p className="panel__status">Searching…</p>}
      {searchStatus === "error" && (
        <p className="panel__status panel__status--error">
          No results found for &quot;{query}&quot;.
        </p>
      )}

      {searchStatus === "done" && searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map((result) => {
            const isWishlisted = wishlist.some(
              (e) => e.title.toLowerCase() === result.game.toLowerCase()
            );
            const resultMeta = metaByTitle[result.game];
            const cheapest =
              result.stores.length > 0 || resultMeta
                ? getCheapestInfo(result, resultMeta, rates)
                : null;
            const { primary } =
              result.stores.length > 0 || resultMeta
                ? buildStoreRow(result, resultMeta, platformOrder)
                : { primary: [] };

            return (
              <li key={result.game} className="search-result-card">
                <div className="search-result-card__row">
                  {result.thumb ? (
                    <img src={result.thumb} alt="" className="search-result-card__thumb" loading="lazy" decoding="async" />
                  ) : (
                    <div className="search-result-card__thumb search-result-card__thumb--placeholder" />
                  )}

                  <div className="search-result-card__info">
                    <span className="wishlist-card__title">{result.game}</span>
                  </div>

                  {cheapest ? (
                    <div className="search-result-card__cheapest">
                      {cheapest.rrp > cheapest.price && (
                        <span className="wishlist-card__rrp">
                          {formatPrice(
                            cheapest.rrp,
                            cheapest.nativeCurrency,
                            rates,
                            currency
                          )}
                        </span>
                      )}
                      <span className="wishlist-card__cheapest-price">
                        {formatPrice(
                          cheapest.price,
                          cheapest.nativeCurrency,
                          rates,
                          currency
                        )}
                      </span>
                      <span className="wishlist-card__cheapest-store">
                        {cheapest.store}
                      </span>
                    </div>
                  ) : (
                    <span className="panel__status">Add to wishlist for full pricing</span>
                  )}

                  <WishlistToggle
                    isWishlisted={isWishlisted}
                    onAdd={() => onAddToWishlist(result.game)}
                    onRemove={() => onRemoveFromWishlist(result.game)}
                    isLoggedIn={isLoggedIn}
                    onSignIn={onSignIn}
                    onCreateAccount={onCreateAccount}
                  />
                </div>

                {primary.length > 0 && (
                  <div className="store-row">
                    {primary.map((s) => (
                      <StoreChip key={s.name} {...s} rates={rates} currency={currency} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
