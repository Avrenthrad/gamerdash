// Auth screen — real email/password via Supabase, plus real OAuth
// sign-in (Google/Apple/Microsoft/Discord) via Supabase's own
// signInWithOAuth. This app now has a real deployed URL, so OAuth is
// no longer blocked the way it was pre-deployment — but each provider
// still needs to be enabled in Supabase's dashboard with real
// credentials from that provider's own developer console before a
// click here does anything but error. See lib/auth.js for the exact
// setup steps per provider. Email confirmation is still deliberately
// off for this early testing pass (see lib/auth.js history).

import { useEffect, useState } from "react";
import LykodexLogo from "./LykodexLogo";
import { signUp, signIn, signInWithOAuth, fetchEnabledOAuthProviders } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabaseClient";
import { isPackagedApp } from "../lib/platform";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
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
  // Packaged apps only: signInWithOAuth opens an external browser and
  // returns right away instead of navigating this page away like on
  // web — this tracks that "still out in the external browser" state
  // so it can show different copy and offer a way out.
  const [oauthWaitingExternally, setOauthWaitingExternally] = useState(false);
  // null = not checked yet — buttons stay enabled and untouched until
  // this resolves (or fails: fails open to null too, rather than
  // disabling every provider just because this one check failed).
  const [enabledProviders, setEnabledProviders] = useState(null);

  useEffect(() => {
    fetchEnabledOAuthProviders()
      .then(setEnabledProviders)
      .catch((err) => console.error("Failed to check enabled OAuth providers:", err));
  }, []);

  // If the user cancels/backs out of that external browser instead of
  // completing sign-in, nothing would otherwise ever clear the
  // waiting state above — Capacitor's Browser plugin firing
  // browserFinished (the in-app browser tab closed, for any reason)
  // and the app resuming from background (covers Tauri's system
  // browser too, which has no equivalent close event of its own) are
  // both good signals that whatever happened out there is done.
  useEffect(() => {
    if (!isPackagedApp()) return;
    let cancelled = false;
    let browserHandle;
    let resumeHandle;

    (async () => {
      if (cancelled) return;
      browserHandle = await Browser.addListener("browserFinished", () => {
        setOauthLoading(null);
        setOauthWaitingExternally(false);
      });
      resumeHandle = await App.addListener("resume", () => {
        setOauthLoading(null);
        setOauthWaitingExternally(false);
      });
    })();

    return () => {
      cancelled = true;
      browserHandle?.remove();
      resumeHandle?.remove();
    };
  }, []);

  async function handleOAuth(provider, label) {
    setOauthError("");

    // Checked up front — attempting a not-yet-enabled provider anyway
    // would navigate (web) or open an external browser (packaged)
    // straight to Supabase's raw "provider is not enabled" JSON error
    // page, since supabase-js has no way to know that client-side
    // before making the request.
    if (enabledProviders?.[provider] === false) {
      setOauthError(`${label} sign-in isn't available yet.`);
      return;
    }

    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider);
      // Web: a successful call means the browser is about to navigate
      // away to the provider — nothing further to do here. Packaged
      // apps: the external browser just launched and this page is
      // still showing, so switch to the distinct waiting state above.
      if (isPackagedApp()) setOauthWaitingExternally(true);
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

  function cancelOauthWait() {
    setOauthLoading(null);
    setOauthWaitingExternally(false);
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
          {oauthProviders.map((p) => {
            const notEnabled = enabledProviders?.[p.provider] === false;
            return (
              <button
                key={p.name}
                type="button"
                className="auth-oauth-btn"
                onClick={() => handleOAuth(p.provider, p.name)}
                disabled={oauthLoading !== null || notEnabled}
                title={notEnabled ? `${p.name} sign-in isn't available yet` : undefined}
              >
                <span className="auth-oauth-btn__mark">{p.initial}</span>
                {oauthLoading === p.provider
                  ? isPackagedApp()
                    ? "Waiting…"
                    : "Redirecting…"
                  : notEnabled
                    ? `${p.name} (soon)`
                    : p.name}
              </button>
            );
          })}
        </div>
        {oauthWaitingExternally && (
          <div className="auth-oauth-waiting">
            <p className="panel__status">Finish signing in in the browser that just opened…</p>
            <button type="button" className="auth-card__switch" onClick={cancelOauthWait}>
              Cancel
            </button>
          </div>
        )}
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
