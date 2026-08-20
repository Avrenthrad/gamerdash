// Real user-to-user marketplace — shared by TCG and Collectibles (see
// lib/marketplace.js for why this is one table/component with a
// category prop rather than two separate features). No in-app
// payments or chat for v1: "Contact Seller" sends a real Lykodex
// friend request (the existing friend system), which is the honest
// way a buyer and seller actually get in touch to arrange a sale.

import { useEffect, useState } from "react";
import {
  fetchListings, fetchMyListings, createListing,
  updateListingStatus, deleteListing, uploadListingPhoto, contactSeller,
  createOffer, fetchOffersForListing, fetchMyOffers, respondToOffer, respondToCounter, withdrawOffer,
} from "../lib/marketplace";
import { getExchangeRates, formatPrice, SUPPORTED_CURRENCIES } from "../lib/currency";
import { AccountGatePanel } from "./AccountGate";
import MiniAvatar from "./MiniAvatar";

const CONDITION_OPTIONS = {
  tcg: ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"],
  collectibles: ["Mint", "Near Mint", "Good", "Fair", "Poor"],
};

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "post", label: "Post a Listing" },
  { id: "mine", label: "My Listings" },
  { id: "offers", label: "My Offers" },
];

function displaySellerName(seller) {
  if (!seller) return "A Lykodex user";
  const full = [seller.first_name, seller.last_name].filter(Boolean).join(" ");
  return full || seller.username || "A Lykodex user";
}

export default function MarketplaceSection({ category, game, userId, isLoggedIn, onSignIn, onCreateAccount, currency }) {
  const [tab, setTab] = useState("browse");
  const [rates, setRates] = useState(null);

  useEffect(() => {
    getExchangeRates().then(setRates);
  }, []);

  return (
    <div>
      <div className="backlog-status-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`quickdash-reset-btn ${tab === t.id ? "quickdash-reset-btn--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <BrowseTab category={category} game={game} userId={userId} isLoggedIn={isLoggedIn} rates={rates} currency={currency} />
      )}

      {tab === "post" && (
        isLoggedIn ? (
          <PostTab category={category} game={game} userId={userId} onPosted={() => setTab("mine")} />
        ) : (
          <AccountGatePanel message="Sign in to post a listing." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
        )
      )}

      {tab === "mine" && (
        isLoggedIn ? (
          <MyListingsTab category={category} game={game} userId={userId} rates={rates} currency={currency} />
        ) : (
          <AccountGatePanel message="Sign in to see your listings." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
        )
      )}

      {tab === "offers" && (
        isLoggedIn ? (
          <MyOffersTab userId={userId} rates={rates} currency={currency} />
        ) : (
          <AccountGatePanel message="Sign in to see your offers." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
        )
      )}
    </div>
  );
}

function BrowseTab({ category, game, userId, isLoggedIn, rates, currency }) {
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [contactStatus, setContactStatus] = useState({}); // listingId -> "sending" | "sent" | "already_sent" | "error"
  const [offerFormListingId, setOfferFormListingId] = useState(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerStatus, setOfferStatus] = useState({}); // listingId -> "sending" | "sent" | "error"

  useEffect(() => {
    setStatus("loading");
    fetchListings(category, { excludeUserId: userId, game })
      .then((rows) => {
        setListings(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load marketplace listings:", err);
        setStatus("error");
      });
  }, [category, game, userId]);

  async function handleContact(listing) {
    if (!isLoggedIn) return;
    setContactStatus((prev) => ({ ...prev, [listing.id]: "sending" }));
    try {
      const result = await contactSeller(userId, listing.user_id);
      setContactStatus((prev) => ({ ...prev, [listing.id]: result }));
    } catch (err) {
      console.error("Failed to contact seller:", err);
      setContactStatus((prev) => ({ ...prev, [listing.id]: "error" }));
    }
  }

  function openOfferForm(listing) {
    setOfferFormListingId(listing.id);
    setOfferAmount(String(listing.price));
    setOfferMessage("");
  }

  async function handleSubmitOffer(e, listing) {
    e.preventDefault();
    if (!offerAmount) return;
    setOfferStatus((prev) => ({ ...prev, [listing.id]: "sending" }));
    try {
      await createOffer(listing.id, userId, {
        amount: Number(offerAmount),
        currency: listing.currency,
        message: offerMessage.trim() || null,
      });
      setOfferStatus((prev) => ({ ...prev, [listing.id]: "sent" }));
      setOfferFormListingId(null);
    } catch (err) {
      console.error("Failed to send offer:", err);
      setOfferStatus((prev) => ({ ...prev, [listing.id]: "error" }));
    }
  }

  if (status === "loading") return <p className="panel__status">Loading listings…</p>;
  if (status === "error") return <p className="panel__status panel__status--error">Couldn't load listings right now.</p>;
  if (listings.length === 0) return <p className="panel__status">Nothing for sale yet — be the first to post one.</p>;

  return (
    <div className="marketplace-grid">
      {listings.map((listing) => (
        <div key={listing.id} className="wishlist-card">
          <div className="wishlist-card__thumb-wrap">
            {listing.photo_url ? (
              <img src={listing.photo_url} alt="" className="wishlist-card__thumb" />
            ) : (
              <div className="wishlist-card__thumb wishlist-card__thumb--placeholder" />
            )}
          </div>
          <div className="wishlist-card__body">
            <span className="wishlist-card__title">{listing.title}</span>
            <span className="wishlist-card__meta" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MiniAvatar profile={listing.seller} />
              {displaySellerName(listing.seller)}
            </span>
            {listing.condition && <span className="tag tag--muted">{listing.condition}</span>}
            {listing.description && <span className="wishlist-card__lowest">{listing.description}</span>}
            <div className="wishlist-card__cheapest">
              <span className="wishlist-card__cheapest-price">
                {rates ? formatPrice(listing.price, listing.currency, rates, currency || listing.currency) : `${listing.currency} ${listing.price}`}
              </span>
            </div>
            {isLoggedIn ? (
              <div className="settings-form-row">
                <button
                  type="button"
                  className="linking-row__connect"
                  onClick={() => handleContact(listing)}
                  disabled={contactStatus[listing.id] === "sending" || contactStatus[listing.id] === "sent" || contactStatus[listing.id] === "already_sent"}
                >
                  {contactStatus[listing.id] === "sending" && "Sending…"}
                  {contactStatus[listing.id] === "sent" && "Friend request sent"}
                  {contactStatus[listing.id] === "already_sent" && "Request already sent"}
                  {contactStatus[listing.id] === "error" && "Couldn't send — try again"}
                  {!contactStatus[listing.id] && "Contact Seller"}
                </button>
                <button
                  type="button"
                  className="quickdash-reset-btn"
                  onClick={() => openOfferForm(listing)}
                  disabled={offerStatus[listing.id] === "sent"}
                >
                  {offerStatus[listing.id] === "sent" ? "Offer sent" : "Make an Offer"}
                </button>
              </div>
            ) : (
              <span className="panel__status" style={{ margin: 0 }}>Sign in to contact the seller</span>
            )}

            {offerFormListingId === listing.id && (
              <form className="backlog-add" onSubmit={(e) => handleSubmitOffer(e, listing)} style={{ flexDirection: "column", alignItems: "stretch", gap: "8px", marginTop: "8px" }}>
                <input
                  className="price-search__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  required
                />
                <input
                  className="price-search__input"
                  type="text"
                  placeholder="Optional message…"
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                />
                <div className="settings-form-row">
                  <button type="submit" className="price-search__button" disabled={offerStatus[listing.id] === "sending"}>
                    {offerStatus[listing.id] === "sending" ? "Sending…" : "Send offer"}
                  </button>
                  <button type="button" className="game-popup__close" onClick={() => setOfferFormListingId(null)} aria-label="Cancel">✕</button>
                </div>
                {offerStatus[listing.id] === "error" && <p className="panel__status panel__status--error">Couldn't send that offer — try again.</p>}
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostTab({ category, game, userId, onPosted }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [condition, setCondition] = useState(CONDITION_OPTIONS[category][0]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | saving | error

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !price) return;
    setStatus("saving");
    try {
      let photoUrl = null;
      if (photoFile) photoUrl = await uploadListingPhoto(userId, photoFile);
      await createListing(userId, {
        category,
        game,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        currency,
        condition,
        photoUrl,
      });
      setTitle("");
      setDescription("");
      setPrice("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setStatus("idle");
      onPosted();
    } catch (err) {
      console.error("Failed to post listing:", err);
      setStatus("error");
    }
  }

  return (
    <form className="backlog-add" onSubmit={handleSubmit} style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
      <input
        className="price-search__input"
        type="text"
        placeholder="What are you selling?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        className="price-search__input"
        type="text"
        placeholder="Description — condition details, what's included, etc. (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="price-search">
        <input
          className="price-search__input"
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <label className="currency-picker">
          <span>Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </label>
        <label className="currency-picker">
          <span>Condition</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {CONDITION_OPTIONS[category].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="settings-avatar__upload" style={{ alignSelf: "flex-start" }}>
        {photoFile ? "Change photo" : "Add a photo"}
        <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
      </label>
      {photoPreview && <img src={photoPreview} alt="" className="search-result-card__thumb" style={{ width: "160px", height: "90px" }} />}
      <button type="submit" className="price-search__button" disabled={status === "saving"} style={{ alignSelf: "flex-start" }}>
        {status === "saving" ? "Posting…" : "Post listing"}
      </button>
      {status === "error" && <p className="panel__status panel__status--error">Couldn't post that listing — try again.</p>}
    </form>
  );
}

function MyListingsTab({ category, game, userId, rates, currency }) {
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [expandedListingId, setExpandedListingId] = useState(null);

  function load() {
    setStatus("loading");
    fetchMyListings(userId, category, game)
      .then((rows) => {
        setListings(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load your listings:", err);
        setStatus("error");
      });
  }

  useEffect(load, [category, game, userId]);

  async function handleMarkSold(listingId) {
    try {
      await updateListingStatus(listingId, "sold");
      load();
    } catch (err) {
      console.error("Failed to mark listing sold:", err);
    }
  }

  async function handleRemove(listingId) {
    try {
      await deleteListing(listingId);
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (err) {
      console.error("Failed to remove listing:", err);
    }
  }

  if (status === "loading") return <p className="panel__status">Loading your listings…</p>;
  if (status === "error") return <p className="panel__status panel__status--error">Couldn't load your listings right now.</p>;
  if (listings.length === 0) return <p className="panel__status">You haven't posted anything yet.</p>;

  return (
    <ul className="backlog-list">
      {listings.map((listing) => (
        <li key={listing.id} className="backlog-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {listing.photo_url ? (
              <img src={listing.photo_url} alt="" className="backlog-card__thumb" />
            ) : (
              <div className="backlog-card__thumb backlog-card__thumb--placeholder" />
            )}
            <div className="backlog-card__info">
              <span className="backlog-card__title">{listing.title}</span>
              <div className="backlog-card__meta">
                <span className="tag tag--muted">{listing.status}</span>
                {listing.condition && <span>{listing.condition}</span>}
                <span>{rates ? formatPrice(listing.price, listing.currency, rates, currency || listing.currency) : `${listing.currency} ${listing.price}`}</span>
              </div>
            </div>
            <button type="button" className="quickdash-reset-btn" onClick={() => setExpandedListingId((id) => (id === listing.id ? null : listing.id))}>
              {expandedListingId === listing.id ? "Hide offers" : "View offers"}
            </button>
            {listing.status === "active" && (
              <button type="button" className="quickdash-reset-btn" onClick={() => handleMarkSold(listing.id)}>
                Mark as Sold
              </button>
            )}
            <button type="button" className="game-popup__close" onClick={() => handleRemove(listing.id)} aria-label="Remove listing">✕</button>
          </div>
          {expandedListingId === listing.id && (
            <ListingOffersPanel listing={listing} rates={rates} currency={currency} />
          )}
        </li>
      ))}
    </ul>
  );
}

// Seller-side: real offers on one of the seller's own listings, with
// Accept/Decline/Counter — one counter round only, see lib/marketplace.js.
function ListingOffersPanel({ listing, rates, currency }) {
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [counterFormOfferId, setCounterFormOfferId] = useState(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterMessage, setCounterMessage] = useState("");

  function load() {
    setStatus("loading");
    fetchOffersForListing(listing.id)
      .then((rows) => {
        setOffers(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load offers:", err);
        setStatus("error");
      });
  }

  useEffect(load, [listing.id]);

  async function handleAccept(offer) {
    try {
      await respondToOffer(offer.id, { status: "accepted" });
      load();
    } catch (err) {
      console.error("Failed to accept offer:", err);
    }
  }

  async function handleDecline(offer) {
    try {
      await respondToOffer(offer.id, { status: "declined" });
      load();
    } catch (err) {
      console.error("Failed to decline offer:", err);
    }
  }

  function openCounterForm(offer) {
    setCounterFormOfferId(offer.id);
    setCounterAmount(String(offer.amount));
    setCounterMessage("");
  }

  async function handleSubmitCounter(e, offer) {
    e.preventDefault();
    if (!counterAmount) return;
    try {
      await respondToOffer(offer.id, {
        status: "countered",
        counterAmount: Number(counterAmount),
        counterMessage: counterMessage.trim() || null,
      });
      setCounterFormOfferId(null);
      load();
    } catch (err) {
      console.error("Failed to counter offer:", err);
    }
  }

  if (status === "loading") return <p className="panel__status">Loading offers…</p>;
  if (status === "error") return <p className="panel__status panel__status--error">Couldn't load offers right now.</p>;
  if (offers.length === 0) return <p className="panel__status">No offers on this listing yet.</p>;

  return (
    <ul className="backlog-list" style={{ marginTop: "12px" }}>
      {offers.map((offer) => (
        <li key={offer.id} className="backlog-card">
          <MiniAvatar profile={offer.buyer} />
          <div className="backlog-card__info">
            <span className="backlog-card__title">
              {displaySellerName(offer.buyer)} offered {rates ? formatPrice(offer.amount, offer.currency, rates, currency || offer.currency) : `${offer.currency} ${offer.amount}`}
            </span>
            <div className="backlog-card__meta">
              <span className="tag tag--muted">{offer.status}</span>
              {offer.message && <span>"{offer.message}"</span>}
              {offer.status === "countered" && offer.counter_amount != null && (
                <span>Your counter: {offer.currency} {offer.counter_amount}</span>
              )}
            </div>
          </div>
          {offer.status === "pending" && (
            <div className="settings-form-row">
              <button type="button" className="linking-row__connect" onClick={() => handleAccept(offer)}>Accept</button>
              <button type="button" className="quickdash-reset-btn" onClick={() => openCounterForm(offer)}>Counter</button>
              <button type="button" className="game-popup__close" onClick={() => handleDecline(offer)} aria-label="Decline offer">✕</button>
            </div>
          )}
          {counterFormOfferId === offer.id && (
            <form className="backlog-add" onSubmit={(e) => handleSubmitCounter(e, offer)} style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
              <input
                className="price-search__input"
                type="number"
                min="0"
                step="0.01"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                required
              />
              <input
                className="price-search__input"
                type="text"
                placeholder="Optional message…"
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
              />
              <button type="submit" className="price-search__button">Send counter</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

// Buyer-side: every offer the signed-in user has made, across every
// listing/category/game.
function MyOffersTab({ userId, rates, currency }) {
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");

  function load() {
    setStatus("loading");
    fetchMyOffers(userId)
      .then((rows) => {
        setOffers(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load your offers:", err);
        setStatus("error");
      });
  }

  useEffect(load, [userId]);

  async function handleAcceptCounter(offer) {
    try {
      await respondToCounter(offer.id, true);
      load();
    } catch (err) {
      console.error("Failed to accept counter:", err);
    }
  }

  async function handleDeclineCounter(offer) {
    try {
      await respondToCounter(offer.id, false);
      load();
    } catch (err) {
      console.error("Failed to decline counter:", err);
    }
  }

  async function handleWithdraw(offer) {
    try {
      await withdrawOffer(offer.id);
      load();
    } catch (err) {
      console.error("Failed to withdraw offer:", err);
    }
  }

  if (status === "loading") return <p className="panel__status">Loading your offers…</p>;
  if (status === "error") return <p className="panel__status panel__status--error">Couldn't load your offers right now.</p>;
  if (offers.length === 0) return <p className="panel__status">You haven't made any offers yet.</p>;

  return (
    <ul className="backlog-list">
      {offers.map((offer) => (
        <li key={offer.id} className="backlog-card">
          {offer.listing?.photo_url ? (
            <img src={offer.listing.photo_url} alt="" className="backlog-card__thumb" />
          ) : (
            <div className="backlog-card__thumb backlog-card__thumb--placeholder" />
          )}
          <div className="backlog-card__info">
            <span className="backlog-card__title">{offer.listing?.title || "Listing no longer available"}</span>
            <div className="backlog-card__meta">
              <span className="tag tag--muted">{offer.status}</span>
              <span>You offered {rates ? formatPrice(offer.amount, offer.currency, rates, currency || offer.currency) : `${offer.currency} ${offer.amount}`}</span>
              {offer.status === "countered" && offer.counter_amount != null && (
                <span>Seller countered: {offer.currency} {offer.counter_amount}{offer.counter_message ? ` — "${offer.counter_message}"` : ""}</span>
              )}
            </div>
          </div>
          {offer.status === "countered" && (
            <div className="settings-form-row">
              <button type="button" className="linking-row__connect" onClick={() => handleAcceptCounter(offer)}>Accept</button>
              <button type="button" className="game-popup__close" onClick={() => handleDeclineCounter(offer)} aria-label="Decline counter">✕</button>
            </div>
          )}
          {offer.status === "pending" && (
            <button type="button" className="game-popup__close" onClick={() => handleWithdraw(offer)} aria-label="Withdraw offer">✕ Withdraw</button>
          )}
        </li>
      ))}
    </ul>
  );
}
