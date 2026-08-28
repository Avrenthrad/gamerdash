// First (and only required) onboarding step — which of the 5 Colleges
// someone actually cares about. All 5 are real and built; picking one
// just controls what shows up in their nav and Overview, not what's
// unlocked (data/colleges.js's `built` flag drives the "Coming soon"
// badge below if a College is ever added ahead of its data layer).

import { COLLEGES } from "../data/colleges";
import CollegeIcon from "./CollegeIcon";

export default function OnboardingCollegePicker({ firstName, selected, onChange, onContinue }) {
  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="onboarding-welcome onboarding-welcome--hero">
      <h1 className="onboarding-welcome__title">
        {firstName ? `Welcome to Lykodex, ${firstName}` : "Welcome to Lykodex"}
      </h1>
      <p className="onboarding-welcome__body">
        Pick the Colleges you want in your nav — you can change this any time in Account Settings.
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
            <CollegeIcon collegeId={college.id} size={26} className="college-picker-card__icon" />
            <span className="college-picker-card__label">{college.label}</span>
            <span className="college-picker-card__tagline">{college.tagline}</span>
            {!college.built && <span className="college-picker-card__badge">Coming soon</span>}
            {selected.includes(college.id) && (
              <span className="college-picker-card__check" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <button type="button" className="auth-form__submit" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
