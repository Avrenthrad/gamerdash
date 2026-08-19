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
} from "../lib/marketplace";
import { getExchangeRates, formatPrice, SUPPORTED_CURRENCIES } from "../lib/currency";
import { AccountGatePanel } from "./AccountGate";

const CONDITION_OPTIONS = {
  tcg: ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"],
  collectibles: ["Mint", "Near Mint", "Good", "Fair", "Poor"],
};

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "post", label: "Post a Listing" },
  { id: "mine", label: "My Listings" },
];

function displaySellerName(seller) {
  if (!seller) return "A Lykodex user";
  const full = [seller.first_name, seller.last_name].filter(Boolean).join(" ");
  return full || seller.username || "A Lykodex user";
}

export default function MarketplaceSection({ category, userId, isLoggedIn, onSignIn, onCreateAccount, currency }) {
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
        <BrowseTab category={category} userId={userId} isLoggedIn={isLoggedIn} rates={rates} currency={currency} />
      )}

      {tab === "post" && (
        isLoggedIn ? (
          <PostTab category={category} userId={userId} onPosted={() => setTab("mine")} />
        ) : (
          <AccountGatePanel message="Sign in to post a listing." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
        )
      )}

      {tab === "mine" && (
        isLoggedIn ? (
          <MyListingsTab category={category} userId={userId} rates={rates} currency={currency} />
        ) : (
          <AccountGatePanel message="Sign in to see your listings." onSignIn={onSignIn} onCreateAccount={onCreateAccount} />
        )
      )}
    </div>
  );
}

function BrowseTab({ category, userId, isLoggedIn, rates, currency }) {
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState("loading");
  const [contactStatus, setContactStatus] = useState({}); // listingId -> "sending" | "sent" | "already_sent" | "error"

  useEffect(() => {
    setStatus("loading");
    fetchListings(category, { excludeUserId: userId })
      .then((rows) => {
        setListings(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load marketplace listings:", err);
        setStatus("error");
      });
  }, [category, userId]);

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
            <span className="wishlist-card__meta">{displaySellerName(listing.seller)}</span>
            {listing.condition && <span className="tag tag--muted">{listing.condition}</span>}
            {listing.description && <span className="wishlist-card__lowest">{listing.description}</span>}
            <div className="wishlist-card__cheapest">
              <span className="wishlist-card__cheapest-price">
                {rates ? formatPrice(listing.price, listing.currency, rates, currency || listing.currency) : `${listing.currency} ${listing.price}`}
              </span>
            </div>
            {isLoggedIn ? (
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
            ) : (
              <span className="panel__status" style={{ margin: 0 }}>Sign in to contact the seller</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostTab({ category, userId, onPosted }) {
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

function MyListingsTab({ category, userId, rates, currency }) {
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState("loading");

  function load() {
    setStatus("loading");
    fetchMyListings(userId, category)
      .then((rows) => {
        setListings(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load your listings:", err);
        setStatus("error");
      });
  }

  useEffect(load, [category, userId]);

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
        <li key={listing.id} className="backlog-card">
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
          {listing.status === "active" && (
            <button type="button" className="quickdash-reset-btn" onClick={() => handleMarkSold(listing.id)}>
              Mark as Sold
            </button>
          )}
          <button type="button" className="game-popup__close" onClick={() => handleRemove(listing.id)} aria-label="Remove listing">✕</button>
        </li>
      ))}
    </ul>
  );
}
