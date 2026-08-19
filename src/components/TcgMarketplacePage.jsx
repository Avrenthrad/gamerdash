// TCG Marketplace — thin page shell around the real shared
// MarketplaceSection (see MarketplaceSection.jsx / lib/marketplace.js).

import MarketplaceSection from "./MarketplaceSection";

export default function TcgMarketplacePage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount, currency }) {
  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to TCG</button>
        <h1 className="price-page__title">TCG Marketplace</h1>
        <p className="price-page__subtitle">
          Real listings from real Lykodex users — buy and sell cards directly with each other.
        </p>
      </div>

      <MarketplaceSection
        category="tcg"
        userId={userId}
        isLoggedIn={isLoggedIn}
        onSignIn={onSignIn}
        onCreateAccount={onCreateAccount}
        currency={currency}
      />
    </div>
  );
}
