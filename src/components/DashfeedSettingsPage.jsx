// Dashfeed Settings.
// Controls how much information gets pulled into the dashboards —
// which games and stores actually show up. Distinct from Account
// Linking (which connects the accounts) and Account Management
// (which controls the profile) — this page is purely a display filter.
//
// Also doubles as the onboarding step right after signup (variant="onboarding").
//
// Genuinely wired to real downstream effects now (previously these
// toggles were local-only state with nothing reading them, and the
// Save button had no click handler at all):
//   - Live service games -> filters what shows in Game Services
//     (LiveServiceSection.jsx)
//   - Stores -> filters which store chips show on wishlist cards
//     (via platformOrder in PriceComparisonPage.jsx)
// The "Platforms" group (library/achievement tracking) is still
// stored but not yet consumed anywhere — Collections/Friends are
// Steam-only right now, so there's nothing to filter by platform yet.
// Ready for when that becomes real.

// Presentation-only now — all toggle state lives in App.jsx and is
// passed down as props (same pattern as everything else "account"-
// shaped in this app), so this file doesn't need React state itself.

const liveServiceGames = ["Destiny 2", "Fortnite", "League of Legends", "Valorant"];

// Matches the real 7 always-visible store chips (PRIORITY_STORE_NAMES
// in PriceComparisonPage.jsx) — previously this list had "EA App" and
// "Ubisoft Connect" (which aren't real chips anywhere in the app) and
// was missing GOG/Epic/Humble/G2A (which are), so toggling them did
// nothing and several real stores couldn't be toggled at all.
const stores = [
  "Steam", "Xbox Store", "PlayStation Store",
  "GOG", "Epic Games Store", "Humble Store", "G2A",
];

const platforms = [
  "Steam", "PlayStation", "Xbox", "Epic Games",
  "Riot Games", "Discord", "Nintendo",
];

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span className="toggle-row__label">{label}</span>
      <span className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="toggle-switch__track" />
        <span className="toggle-switch__thumb" />
      </span>
    </label>
  );
}

export default function DashfeedSettingsPage({
  variant = "settings",
  onFinishOnboarding,
  gameToggles,
  onGameTogglesChange,
  storeToggles,
  onStoreTogglesChange,
  platformToggles,
  onPlatformTogglesChange,
}) {
  function toggle(current, onChange, key) {
    onChange({ ...current, [key]: !current[key] });
  }

  const isOnboarding = variant === "onboarding";

  return (
    <div className="settings-page">
      <div className="settings-page__head">
        <h1 className="settings-page__title">
          {isOnboarding ? "Set up your Dashfeed" : "Dashfeed Settings"}
        </h1>
        <p className="settings-page__subtitle">
          {isOnboarding
            ? "Tell us what you play and where you shop, so your dashboards only show what's relevant."
            : "Control how much information gets pulled into your dashboards."}
        </p>
      </div>

      <section className="settings-card">
        <h2 className="settings-card__title">Live service games</h2>
        <p className="settings-card__note">Games shown in your Game Services feed.</p>
        <div className="identifier-list">
          {liveServiceGames.map((g) => (
            <ToggleRow
              key={g}
              label={g}
              checked={gameToggles[g]}
              onChange={() => toggle(gameToggles, onGameTogglesChange, g)}
            />
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-card__title">Stores</h2>
        <p className="settings-card__note">Stores included in your price comparisons.</p>
        <div className="identifier-list">
          {stores.map((s) => (
            <ToggleRow
              key={s}
              label={s}
              checked={storeToggles[s]}
              onChange={() => toggle(storeToggles, onStoreTogglesChange, s)}
            />
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-card__title">Platforms</h2>
        <p className="settings-card__note">Platforms included in your library and achievement tracking.</p>
        <div className="identifier-list">
          {platforms.map((p) => (
            <ToggleRow
              key={p}
              label={p}
              checked={platformToggles[p]}
              onChange={() => toggle(platformToggles, onPlatformTogglesChange, p)}
            />
          ))}
        </div>
      </section>

      {isOnboarding ? (
        <div className="onboarding-actions">
          <button type="button" className="auth-form__submit settings-save" onClick={onFinishOnboarding}>
            Finish setup
          </button>
          <button type="button" className="dash-header__login-btn onboarding-skip" onClick={onFinishOnboarding}>
            Skip for now
          </button>
        </div>
      ) : (
        <button type="button" className="auth-form__submit settings-save" onClick={onFinishOnboarding}>Save changes</button>
      )}
    </div>
  );
}
