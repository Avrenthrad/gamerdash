// Auth screen — real email/password via Supabase, plus real OAuth
// sign-in (Google/Apple/Microsoft/Discord) via Supabase's own
// signInWithOAuth. This app now has a real deployed URL, so OAuth is
// no longer blocked the way it was pre-deployment — but each provider
// still needs to be enabled in Supabase's dashboard with real
// credentials from that provider's own developer console before a
// click here does anything but error. See lib/auth.js for the exact
// setup steps per provider. Email confirmation is still deliberately
// off for this early testing pass (see lib/auth.js history).

import { useState } from "react";
import LykodexLogo from "./LykodexLogo";
import { signUp, signIn, signInWithOAuth } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabaseClient";
import CollectionConstellationBackground from "./CollectionConstellationBackground";

const oauthProviders = [
  { name: "Google", provider: "google", initial: "G" },
  { name: "Apple", provider: "apple", initial: "A" },
  { name: "Microsoft", provider: "azure", initial: "M" },
  { name: "Discord", provider: "discord", initial: "D" },
];

export default function LoginPage({ onLoginSuccess, initialMode }) {
  const [mode, setMode] = useState(initialMode || "login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");

  // Which OAuth button (if any) is mid-redirect, and any error from
  // kicking that off — keyed so one provider erroring doesn't disable
  // the others.
  const [oauthLoading, setOauthLoading] = useState(null);
  const [oauthError, setOauthError] = useState("");

  async function handleOAuth(provider, label) {
    setOauthError("");
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider);
      // On success the browser navigates away to the provider — this
      // line only runs if that redirect itself failed to kick off.
    } catch (err) {
      console.error(`${label} sign-in failed:`, err);
      setOauthError(
        err.message?.toLowerCase().includes("provider is not enabled")
          ? `${label} sign-in isn't available yet.`
          : err.message || `Couldn't start ${label} sign-in.`
      );
      setOauthLoading(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!supabaseConfigured) {
      setError("Accounts aren't set up yet.");
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
            ? "Account created — check your email to confirm it, then sign in."
            : "Signed in, but something went wrong — try refreshing."
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
      <CollectionConstellationBackground />
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
            Accounts aren't set up yet on this deployment.
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
              onClick={() => handleOAuth(p.provider, p.name)}
              disabled={oauthLoading !== null}
            >
              <span className="auth-oauth-btn__mark">{p.initial}</span>
              {oauthLoading === p.provider ? "Redirecting…" : p.name}
            </button>
          ))}
        </div>
        {oauthError && <p className="panel__status panel__status--error">{oauthError}</p>}

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
