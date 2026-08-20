// TCG Marketplace — thin page shell around the real shared
// MarketplaceSection (see MarketplaceSection.jsx / lib/marketplace.js).
// One shared "tcg" category listing board, split by an in-page MTG/FaB
// toggle rather than a second route — same reasoning TcgHomePage.jsx's
// own game tabs already use.

import { useState } from "react";
import MarketplaceSection from "./MarketplaceSection";

export default function TcgMarketplacePage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount, currency }) {
  const [game, setGame] = useState("mtg");

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to TCG</button>
        <h1 className="price-page__title">TCG Marketplace</h1>
        <p className="price-page__subtitle">
          Real listings from real Lykodex users — buy and sell cards directly with each other.
        </p>
      </div>

      <div className="backlog-status-tabs">
        <button type="button" className={`quickdash-reset-btn ${game === "mtg" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setGame("mtg")}>Magic: The Gathering</button>
        <button type="button" className={`quickdash-reset-btn ${game === "fab" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setGame("fab")}>Flesh and Blood</button>
        <button type="button" className={`quickdash-reset-btn ${game === "pokemon" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setGame("pokemon")}>Pokémon</button>
      </div>

      <MarketplaceSection
        category="tcg"
        game={game}
        userId={userId}
        isLoggedIn={isLoggedIn}
        onSignIn={onSignIn}
        onCreateAccount={onCreateAccount}
        currency={currency}
      />
    </div>
  );
}
