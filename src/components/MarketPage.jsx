// In Game Stores.
// One collapsible section per game, each showing a preview of a few
// items plus a countdown to when that shop rotates/resets. Fortnite
// is the only one wired up with real data right now (via
// fortnite-api.com, genuinely free/no-key) — Marvel Rivals is a good
// next candidate (MarvelRivalsAPI.com has real store data) but needs
// a free API key first, same pattern as Xbox/XBXprices.
//
// Banner: rather than hotlink Epic's actual trademarked Fortnite logo
// (a copyright/hosting concern, same reasoning as not pulling other
// companies' brand assets directly elsewhere in this project), each
// section header is a stylised colour banner with the game's name —
// swap in a real logo asset here if you have rights to use one.

import { useEffect, useState } from "react";
import { fetchFortniteShop } from "../lib/fortnite";
import { checkBungieStatus, fetchEververseStore } from "../lib/bungie";

const PREVIEW_COUNT = 6;

function useCountdownToUtcMidnight() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const nextMidnightUtc = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      ));
      const diffMs = nextMidnightUtc - now;
      const h = Math.floor(diffMs / 3_600_000);
      const m = Math.floor((diffMs % 3_600_000) / 60_000);
      setLabel(`Resets in ${h}h ${m}m`);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return label;
}

function FortniteSection() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [expanded, setExpanded] = useState(true);
  const resetLabel = useCountdownToUtcMidnight();

  useEffect(() => {
    fetchFortniteShop()
      .then((data) => {
        setItems(data);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Fortnite shop failed:", err);
        setStatus("error");
      });
  }, []);

  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <div className="ingame-store">
      <button
        type="button"
        className="ingame-store__banner ingame-store__banner--fortnite"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="ingame-store__banner-title">FORTNITE</span>
        <span className="ingame-store__banner-sub">Item Shop</span>
        <span className="ingame-store__reset">{status === "ready" ? resetLabel : ""}</span>
        <span className="ingame-store__chevron">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="ingame-store__body">
          {status === "loading" && <p className="panel__status">Loading today's shop…</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">Couldn't load the Fortnite shop right now.</p>
          )}
          {status === "ready" && (
            <div className="fortnite-shop-grid">
              {preview.map((item, i) => (
                <div key={`${item.name}-${i}`} className="fortnite-shop-item">
                  {item.image ? (
                    <img src={item.image} alt="" className="fortnite-shop-item__image" />
                  ) : (
                    <div className="fortnite-shop-item__image fortnite-shop-item__image--placeholder" />
                  )}
                  <span className="fortnite-shop-item__name">{item.name}</span>
                  {item.rarity && <span className="fortnite-shop-item__rarity">{item.rarity}</span>}
                  <span className="fortnite-shop-item__price">{item.price?.toLocaleString()} V-Bucks</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DestinySection() {
  const [connected, setConnected] = useState(null); // null = checking
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    checkBungieStatus().then(setConnected);
  }, []);

  useEffect(() => {
    if (!connected) return;
    setStatus("loading");
    fetchEververseStore()
      .then((result) => {
        if (result === "no_key" || result === "not_connected") {
          setStatus("error");
          return;
        }
        setItems(result.items || []);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Eververse store failed:", err);
        setStatus("error");
      });
  }, [connected]);

  if (connected === null || connected === false) return null; // not linked — nothing to show

  return (
    <div className="ingame-store">
      <button
        type="button"
        className="ingame-store__banner ingame-store__banner--destiny"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="ingame-store__banner-title">DESTINY 2</span>
        <span className="ingame-store__banner-sub">Eververse</span>
        <span className="ingame-store__chevron">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="ingame-store__body">
          {status === "loading" && <p className="panel__status">Loading Eververse…</p>}
          {status === "error" && (
            <p className="panel__status panel__status--error">Couldn't load the Eververse store right now.</p>
          )}
          {status === "ready" && items.length === 0 && (
            <p className="panel__status">Nothing in the Eververse store right now.</p>
          )}
          {status === "ready" && items.length > 0 && (
            <>
              <p className="panel__status">
                Groundwork only — item names/icons need a manifest lookup that isn't built yet,
                so these show as raw item IDs for now.
              </p>
              <div className="fortnite-shop-grid">
                {items.slice(0, 6).map((item, i) => (
                  <div key={`${item.itemHash}-${i}`} className="fortnite-shop-item">
                    <div className="fortnite-shop-item__image fortnite-shop-item__image--placeholder" />
                    <span className="fortnite-shop-item__name">Item #{item.itemHash}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketPage({ onBack }) {
  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Store Tracker</button>
        <h1 className="price-page__title">In Game Stores</h1>
      </div>

      <FortniteSection />
      <DestinySection />

      <div className="ingame-store ingame-store--coming-soon">
        <div className="ingame-store__banner ingame-store__banner--placeholder">
          <span className="ingame-store__banner-title">More games coming</span>
          <span className="ingame-store__banner-sub">
            Marvel Rivals has a real store API too — needs a free key first, same as Xbox did.
          </span>
        </div>
      </div>
    </div>
  );
}
