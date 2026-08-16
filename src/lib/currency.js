import { API_BASE } from "./apiBase";
// Currency conversion for the whole site.
// Two kinds of "native" prices flow through this app:
//   - USD-native: CheapShark prices (GOG/Epic/Humble) — always need
//     converting to whatever currency is being displayed.
//   - AUD-native: Steam and Xbox prices — these are the REAL regional
//     price for Australia specifically (not a currency conversion),
//     so displaying them in AUD needs no conversion at all, but
//     displaying them in any OTHER currency means going AUD -> USD ->
//     target using the same rate table (still an estimate at that
//     point, same as everything CheapShark-sourced always was).
//
// Talks to our own /api/pricing serverless function (service=currency) — Frankfurter
// blocks direct browser requests via CORS, confirmed by real testing.

export const SUPPORTED_CURRENCIES = [
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "USD", symbol: "US$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "NZD", symbol: "NZ$", label: "New Zealand Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
];

// Approximate, USD-based — used only if the live rate fetch fails.
const FALLBACK_RATES = { USD: 1, AUD: 1.55, CAD: 1.36, NZD: 1.68, GBP: 0.79, EUR: 0.92 };

let cachedRates = null;

// Returns a USD-based rate table, e.g. { USD: 1, AUD: 1.55, ... } —
// multiply a USD amount by rates[CODE] to get that currency's amount.
export async function getExchangeRates() {
  if (cachedRates) return cachedRates;
  try {
    const res = await fetch(`${API_BASE}/api/pricing?service=currency`);
    if (!res.ok) throw new Error("Exchange rate fetch failed");
    const data = await res.json();
    cachedRates = { USD: 1, ...data.rates };
  } catch (err) {
    console.error("Falling back to fixed exchange rates:", err);
    cachedRates = FALLBACK_RATES;
  }
  return cachedRates;
}

// The one function every price display in the app should use.
//   amount        — the price, in whatever currency it's native to
//   nativeCurrency — "USD" (CheapShark) or "AUD" (Steam/Xbox real price)
//   rates          — from getExchangeRates()
//   targetCurrency — the currency code the user has selected to view
export function formatPrice(amount, nativeCurrency, rates, targetCurrency) {
  if (amount == null || !rates) return "—";

  const symbol = SUPPORTED_CURRENCIES.find((c) => c.code === targetCurrency)?.symbol || targetCurrency;

  if (nativeCurrency === targetCurrency) {
    return `${symbol}${amount.toFixed(2)}`;
  }

  // Convert to USD first (dividing by the native currency's own
  // USD-based rate), then to the target currency.
  const usdAmount = nativeCurrency === "USD" ? amount : amount / rates[nativeCurrency];
  const converted = usdAmount * rates[targetCurrency];
  return `${symbol}${converted.toFixed(2)}`;
}
