// Auth screen — real email/password via Supabase.
// OAuth (Google/Apple/Discord) needs real redirect URLs to register
// with each provider, which only exist once this is actually deployed —
// so those stay visually present but disabled for now, rather than
// silently pretending to work. See lib/auth.js for why email
// confirmation is also skipped for this first testing pass.

import { useState } from "react";
import LykodexLogo from "./LykodexLogo";
import { signUp, signIn } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabaseClient";

const oauthProviders = [
  { name: "Google", initial: "G" },
  { name: "Apple", initial: "A" },
  { name: "Discord", initial: "D" },
];

export default function LoginPage({ onLoginSuccess, initialMode }) {
  const [mode, setMode] = useState(initialMode || "login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!supabaseConfigured) {
      setError("Accounts aren't set up yet — Supabase isn't configured on this deployment.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("loading");
    try {
      let result;
      if (mode === "signup") {
        result = await signUp(email, password);
      } else {
        result = await signIn(email, password);
      }

      // signUp() can succeed (the account genuinely gets created)
      // without returning an active session — that happens when the
      // Supabase project still has "Confirm email" switched on
      // (Supabase's own default for every new project). Previously
      // this called onLoginSuccess() regardless, which looked exactly
      // like "I made an account and nothing happened" — the account
      // was real, there just was no session yet to actually be
      // logged in with.
      if (!result?.session) {
        setStatus("idle");
        setError(
          mode === "signup"
            ? "Account created — but no session came back, which usually means email confirmation is still switched on in Supabase. Turn off \"Confirm email\" under Authentication > Providers > Email in your Supabase dashboard, then try signing up again."
            : "Signed in, but no session came back — try refreshing, or check Supabase's dashboard for anything unusual on this account."
        );
        return;
      }

      onLoginSuccess(mode);
    } catch (err) {
      console.error("Auth failed:", err);
      setError(err.message || "Something went wrong — try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <LykodexLogo className="auth-card__logo" />
        <h1 className="auth-card__title">
          {mode === "login" ? "Sign in to Lykodex" : "Create your account"}
        </h1>
        <p className="auth-card__subtitle">
          {mode === "login"
            ? "Track prices, achievements, and progress in one place."
            : "Set up your account to start tracking your games."}
        </p>

        {!supabaseConfigured && (
          <p className="panel__status panel__status--error">
            Accounts aren't configured yet on this deployment (missing Supabase setup).
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-form__field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-form__field">
            <span>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {mode === "signup" && (
            <label className="auth-form__field">
              <span>Confirm password</span>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
          )}

          {error && <p className="panel__status panel__status--error">{error}</p>}

          <button type="submit" className="auth-form__submit" disabled={status === "loading"}>
            {status === "loading" ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="auth-oauth-row">
          {oauthProviders.map((p) => (
            <button
              key={p.name}
              type="button"
              className="auth-oauth-btn"
              title={`${p.name} sign-in isn't set up yet — needs a deployed URL first`}
              disabled
            >
              <span className="auth-oauth-btn__mark">{p.initial}</span>
              {p.name}
            </button>
          ))}
        </div>

        <p className="auth-card__mfa-note">
          Two-factor authentication (Google Authenticator) can be enabled after sign-in.
        </p>

        <button
          type="button"
          className="auth-card__switch"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
