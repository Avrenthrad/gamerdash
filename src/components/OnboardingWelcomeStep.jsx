// First step of the post-signup onboarding sequence — a real branded
// welcome moment before diving into preferences/linking. Simple by
// design: this is a one-time first impression, not a page someone
// will spend more than a few seconds on.

import LykodexLogo from "./LykodexLogo";

export default function OnboardingWelcomeStep({ firstName, onContinue }) {
  return (
    <div className="onboarding-welcome onboarding-welcome--hero">
      <LykodexLogo className="onboarding-welcome__logo" />
      <h1 className="onboarding-welcome__title">
        {firstName ? `Welcome to Lykodex, ${firstName}` : "Welcome to Lykodex"}
      </h1>
      <p className="onboarding-welcome__body">
        Real prices, your real library, your real backlog, and friends' real
        activity — all in one place, and all genuinely yours. Let's get your
        account set up.
      </p>
      <button type="button" className="auth-form__submit" onClick={onContinue}>
        Get started
      </button>
    </div>
  );
}
