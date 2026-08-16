// Second step of onboarding — which of the 5 Colleges someone
// actually cares about. Only Gaming and TCG are fully real right now
// (TCG has MTG built); Entertainment/Collectibles/Tabletop are marked
// "Coming soon" so this stays honest — selecting one just captures
// real interest for later, it doesn't unlock functionality that
// doesn't exist yet.

import { COLLEGES } from "../data/colleges";

export default function OnboardingCollegePicker({ selected, onChange, onContinue }) {
  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="onboarding-welcome">
      <h1 className="onboarding-welcome__title">What are you into?</h1>
      <p className="onboarding-welcome__body">
        Pick what you want to see — you can change this any time in Account Settings.
      </p>

      <div className="college-picker-grid">
        {COLLEGES.map((college) => (
          <button
            key={college.id}
            type="button"
            className={`college-picker-card ${selected.includes(college.id) ? "college-picker-card--selected" : ""}`}
            onClick={() => toggle(college.id)}
            aria-pressed={selected.includes(college.id)}
          >
            <span className="college-picker-card__label">{college.label}</span>
            <span className="college-picker-card__tagline">{college.tagline}</span>
            {!college.built && <span className="college-picker-card__badge">Coming soon</span>}
          </button>
        ))}
      </div>

      <button type="button" className="auth-form__submit" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
