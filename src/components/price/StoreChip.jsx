import { formatPrice } from "../../lib/currency";
import { faviconFor, shortStoreName } from "./priceUtils";

function StoreChipLabel({ name }) {
  const favicon = faviconFor(name);
  return (
    <span className="store-chip__label">
      {favicon && <img src={favicon} alt="" className="store-chip__favicon" decoding="async" />}
      <span className="store-chip__name">{shortStoreName(name)}</span>
    </span>
  );
}

/**
 * Single store price chip.
 * States: price | pending | search-link | out_of_stock | unsold
 */
export function StoreChip({
  name,
  price,
  rrp,
  state,
  link,
  rates,
  currency,
  nativeCurrency,
}) {
  if (state === "price") {
    const clickable = Boolean(link);
    const displayPrice = formatPrice(price, nativeCurrency || "USD", rates, currency);
    const onSale = rrp > price;
    const salePct = onSale ? Math.round((1 - price / rrp) * 100) : 0;
    return (
      <button
        type="button"
        className={`store-chip store-chip--price ${clickable ? "store-chip--clickable" : ""}`}
        onClick={clickable ? () => window.open(link, "_blank", "noopener,noreferrer") : undefined}
        disabled={!clickable}
        title={clickable ? `Open ${name} in a new tab` : undefined}
      >
        {onSale && <span className="store-chip__sale-badge">-{salePct}%</span>}
        <StoreChipLabel name={name} />
        <span className="store-chip__value">{displayPrice}</span>
      </button>
    );
  }

  if (state === "pending") {
    return (
      <div className="store-chip store-chip--pending" title="Pending integration">
        <StoreChipLabel name={name} />
        <span className="store-chip__icon">✕</span>
      </div>
    );
  }

  if (state === "search-link") {
    return (
      <button
        type="button"
        className="store-chip store-chip--clickable store-chip--search"
        onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
        title={`Search for this game on ${name}`}
      >
        <StoreChipLabel name={name} />
        <span className="store-chip__value">Search ↗</span>
      </button>
    );
  }

  if (state === "out_of_stock") {
    return (
      <div className="store-chip store-chip--outofstock" title="Out of stock">
        <StoreChipLabel name={name} />
        <span className="store-chip__icon">✕</span>
      </div>
    );
  }

  // "unsold" — confirmed not carried by this store
  return (
    <div className="store-chip store-chip--unsold" title="Not sold here">
      <StoreChipLabel name={name} />
      <span className="store-chip__icon">✕</span>
    </div>
  );
}
