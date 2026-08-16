// Honest placeholder for Entertainment/Collectibles/Tabletop — these
// have no schema, no pages, no real feature yet. This is what someone
// sees if they click into one anyway, rather than a broken blank page
// or (worse) something that looks real but isn't.

export default function CollegeComingSoonPage({ label, icon, description, onBack }) {
  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Overview</button>
      </div>
      <div className="onboarding-welcome">
        <span style={{ fontSize: "40px" }}>{icon}</span>
        <h1 className="onboarding-welcome__title">{label}</h1>
        <p className="onboarding-welcome__body">
          {description} This College genuinely doesn't exist yet — no data, no features. You picked it as an
          interest during onboarding, so it'll show up here the moment there's something real to show.
        </p>
      </div>
    </div>
  );
}
