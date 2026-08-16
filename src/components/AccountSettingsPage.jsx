// Account Settings page.
// Everything here is passed down as controlled props from App.jsx,
// which handles real persistence to Supabase (and localStorage as a
// logged-out fallback) — this component itself stays presentation-only.
//
// Covers: name, avatar upload (preview only), per-platform usernames/
// friend codes with per-field visibility, Twitch/Kick names, timezone,
// theme, platform preferences, and a QR code for adding Lykodex friends.
//
// FIXED A REAL BUG: phone number, timezone, per-platform friend codes,
// streaming names, and their visibility settings used to be plain
// local useState right here in this component — never threaded up to
// App.jsx, never written to Supabase. They looked like they saved
// (typing worked fine) but silently reset to blank on every refresh,
// which is exactly the bug that got reported. Now they're real,
// controlled props like everything else on this page, bundled into
// one profileDetails object/column rather than nine separate ones.
// Also removed a "Save changes" button that had no click handler at
// all — every field on this page already auto-saves (debounced,
// same as the rest of the app), so a dead button implying otherwise
// was actively misleading, not just unfinished.

import { useMemo, useState } from "react";
import ReorderableList from "./ReorderableList";
import { faviconFor, shortStoreName } from "./price/priceUtils";
import { COLLEGES as ALL_COLLEGES } from "../data/colleges";
import { supabase } from "../lib/supabaseClient";

const platforms = [
  { id: "steam", label: "Steam", placeholder: "e.g. mysteamname" },
  { id: "playstation", label: "PlayStation", placeholder: "PSN online ID" },
  { id: "xbox", label: "Xbox", placeholder: "Xbox gamertag" },
  { id: "epic", label: "Epic Games", placeholder: "Epic display name" },
  { id: "riot", label: "Riot Games", placeholder: "Riot ID#Tag (LoL / Valorant)" },
  { id: "discord", label: "Discord", placeholder: "username" },
  { id: "nintendo", label: "Nintendo", placeholder: "Friend code (SW-0000-0000-0000)" },
];

const streaming = [
  { id: "twitch", label: "Twitch", placeholder: "channel name" },
  { id: "kick", label: "Kick", placeholder: "channel name" },
  { id: "youtube", label: "YouTube", placeholder: "channel handle (@name)" },
];

const visibilityOptions = ["Public", "Friends only", "Private"];

// Pull the full IANA timezone list from the browser itself instead of
// hardcoding one — every modern browser ships this list already.
function getTimezoneList() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for older environments that don't support this API yet.
    return ["UTC", "Australia/Darwin", "America/New_York", "Europe/London", "Asia/Tokyo"];
  }
}

function initialVisibility(fields) {
  const map = {};
  fields.forEach((f) => { map[f.id] = "Friends only"; });
  return map;
}

export default function AccountSettingsPage({
  avatarUrl,
  onAvatarChange,
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
  username,
  onUsernameChange,
  accentColor,
  onAccentColorChange,
  themeMode,
  onThemeModeChange,
  platformOrder,
  onPlatformOrderChange,
  xbxpricesKey,
  onXbxpricesKeyChange,
  platpricesKey,
  onPlatpricesKeyChange,
  profileDetails,
  onProfileDetailsChange,
  selectedColleges,
  onSelectedCollegesChange,
  userId,
}) {
  // Genuinely fine to stay local — this is just "is the QR popup
  // currently open," not data worth persisting across sessions.
  const [showQr, setShowQr] = useState(false);

  const details = profileDetails || {};
  const phoneNumber = details.phoneNumber || "";
  const phoneVisibility = details.phoneVisibility || "Private";
  const timezone = details.timezone || "Australia/Darwin";
  const friendNameDisplay = details.friendNameDisplay || "both";
  const platformValues = details.platformValues || {};
  const platformVisibility = details.platformVisibility || initialVisibility(platforms);
  const streamValues = details.streamValues || {};
  const streamLinks = details.streamLinks || {};
  const streamVisibility = details.streamVisibility || initialVisibility(streaming);

  const timezones = useMemo(getTimezoneList, []);
  const [avatarStatus, setAvatarStatus] = useState("idle"); // idle | uploading | error

  // Real upload to Supabase Storage — this used to just create a
  // browser-local blob: URL, which looked like it worked but was
  // never actually saved anywhere. It broke on the very next refresh,
  // new session, or different device, because there was never a real
  // file behind it. This uploads for real and saves back a genuine,
  // permanent public URL.
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setAvatarStatus("uploading");
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image actually shows immediately —
      // browsers otherwise cache the old image at this same URL.
      onAvatarChange(`${data.publicUrl}?t=${Date.now()}`);
      setAvatarStatus("idle");
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setAvatarStatus("error");
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page__head">
        <h1 className="settings-page__title">Account settings</h1>
        <p className="settings-page__subtitle">Manage your profile, linked platform names, and privacy.</p>
      </div>

      {/* Avatar + name */}
      <section className="settings-card">
        <div className="settings-avatar-row">
          <div className="settings-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile avatar preview" />
            ) : (
              <span className="settings-avatar__placeholder">
                {(firstName[0] || "") + (lastName[0] || "") || "?"}
              </span>
            )}
          </div>
          <div className="settings-avatar__controls">
            <label className="settings-avatar__upload">
              Upload photo
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
            <span className="settings-avatar__hint">
              {avatarStatus === "uploading" ? "Uploading…" : avatarStatus === "error" ? "Upload failed — try again" : "Square image, 512×512px recommended."}
            </span>
          </div>
        </div>

        <label className="auth-form__field">
          <span>Username</span>
          <input value={username} onChange={(e) => onUsernameChange(e.target.value)} placeholder="johndash" autoComplete="username" />
        </label>

        <div className="settings-form-row">
          <label className="auth-form__field">
            <span>First name</span>
            <input value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="John" />
          </label>
          <label className="auth-form__field">
            <span>Last name</span>
            <input value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Dashboard" />
          </label>
        </div>

        <div className="identifier-row">
          <span className="identifier-row__label">Phone number</span>
          <input
            className="identifier-row__input"
            type="tel"
            placeholder="+61 400 000 000"
            value={phoneNumber}
            onChange={(e) => onProfileDetailsChange({ phoneNumber: e.target.value })}
          />
          <select
            className="identifier-row__visibility"
            value={phoneVisibility}
            onChange={(e) => onProfileDetailsChange({ phoneVisibility: e.target.value })}
          >
            {visibilityOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <p className="settings-card__note">Used so friends can find you by phone number — kept private by default.</p>
      </section>

      {/* Platform identifiers */}
      <section className="settings-card">
        <h2 className="settings-card__title">Platform usernames &amp; friend codes</h2>
        <p className="settings-card__note">Choose who can see each one on your profile.</p>

        <div className="identifier-list">
          {platforms.map((p) => (
            <div key={p.id} className="identifier-row">
              <span className="identifier-row__label">{p.label}</span>
              <input
                className="identifier-row__input"
                placeholder={p.placeholder}
                value={platformValues[p.id] || ""}
                onChange={(e) => onProfileDetailsChange({ platformValues: { ...platformValues, [p.id]: e.target.value } })}
              />
              <select
                className="identifier-row__visibility"
                value={platformVisibility[p.id]}
                onChange={(e) => onProfileDetailsChange({ platformVisibility: { ...platformVisibility, [p.id]: e.target.value } })}
              >
                {visibilityOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Streaming */}
      <section className="settings-card">
        <h2 className="settings-card__title">Streaming</h2>

        <div className="identifier-list">
          {streaming.map((p) => (
            <div key={p.id} className="stream-row">
              <div className="identifier-row">
                <span className="identifier-row__label">{p.label}</span>
                <input
                  className="identifier-row__input"
                  placeholder={p.placeholder}
                  value={streamValues[p.id] || ""}
                  onChange={(e) => onProfileDetailsChange({ streamValues: { ...streamValues, [p.id]: e.target.value } })}
                />
                <select
                  className="identifier-row__visibility"
                  value={streamVisibility[p.id]}
                  onChange={(e) => onProfileDetailsChange({ streamVisibility: { ...streamVisibility, [p.id]: e.target.value } })}
                >
                  {visibilityOptions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <input
                className="identifier-row__input stream-row__link"
                placeholder={`Link to your ${p.label} channel home page (optional)`}
                value={streamLinks[p.id] || ""}
                onChange={(e) => onProfileDetailsChange({ streamLinks: { ...streamLinks, [p.id]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Timezone */}
      <section className="settings-card">
        <h2 className="settings-card__title">Region</h2>
        <p className="settings-card__note">Sets your local time and currency for prices and reset countdowns.</p>

        <label className="auth-form__field settings-timezone">
          <span>Timezone</span>
          <select value={timezone} onChange={(e) => onProfileDetailsChange({ timezone: e.target.value })}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>
      </section>

      {/* Preferences */}
      <section className="settings-card">
        <h2 className="settings-card__title">Preferences</h2>
        <p className="settings-card__note">How friends' names appear across Lykodex.</p>

        <div className="pref-choice-group" role="radiogroup" aria-label="Friend name display">
          <label className="pref-choice">
            <input
              type="radio"
              name="friendNameDisplay"
              value="username"
              checked={friendNameDisplay === "username"}
              onChange={(e) => onProfileDetailsChange({ friendNameDisplay: e.target.value })}
            />
            <span>Username only</span>
          </label>
          <label className="pref-choice">
            <input
              type="radio"
              name="friendNameDisplay"
              value="realname"
              checked={friendNameDisplay === "realname"}
              onChange={(e) => onProfileDetailsChange({ friendNameDisplay: e.target.value })}
            />
            <span>First name + Last name</span>
          </label>
          <label className="pref-choice">
            <input
              type="radio"
              name="friendNameDisplay"
              value="both"
              checked={friendNameDisplay === "both"}
              onChange={(e) => onProfileDetailsChange({ friendNameDisplay: e.target.value })}
            />
            <span>Both (e.g. "John Dashboard (@johndash)")</span>
          </label>
        </div>
      </section>

      {/* Theme */}
      <section className="settings-card">
        <h2 className="settings-card__title">Theme</h2>
        <p className="settings-card__note">
          Pick a mode and an accent colour — every accent works in both light and dark mode.
        </p>

        <div className="pref-choice-group" role="radiogroup" aria-label="Appearance mode">
          <label className="pref-choice">
            <input
              type="radio"
              name="themeMode"
              value="dark"
              checked={themeMode === "dark"}
              onChange={(e) => onThemeModeChange(e.target.value)}
            />
            <span>Dark mode</span>
          </label>
          <label className="pref-choice">
            <input
              type="radio"
              name="themeMode"
              value="light"
              checked={themeMode === "light"}
              onChange={(e) => onThemeModeChange(e.target.value)}
            />
            <span>Light mode</span>
          </label>
        </div>

        <div className="accent-swatch-row" role="radiogroup" aria-label="Accent colour">
          {[
            { id: "red", label: "Red" },
            { id: "yellow", label: "Yellow" },
            { id: "purple", label: "Purple" },
            { id: "blue", label: "Blue" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`accent-swatch accent-swatch--${option.id} ${accentColor === option.id ? "accent-swatch--active" : ""}`}
              onClick={() => onAccentColorChange(option.id)}
              aria-pressed={accentColor === option.id}
              title={option.label}
            >
              <span className="accent-swatch__dot" />
              <span className="accent-swatch__label">{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Colleges — the same picker shown at onboarding, but editable
          any time here. Fixes a real gap: onboarding's College Picker
          only ever runs once at signup, so anyone whose account
          predates it (or who just changes their mind later) had no
          way to ever add more Colleges without this. */}
      <section className="settings-card">
        <h2 className="settings-card__title">Colleges</h2>
        <p className="settings-card__note">
          Choose what shows up in your top navigation. Gaming and TCG are fully real; the others are marked honestly as not built yet.
        </p>
        <div className="college-picker-grid">
          {ALL_COLLEGES.map((college) => (
            <button
              key={college.id}
              type="button"
              className={`college-picker-card ${selectedColleges?.includes(college.id) ? "college-picker-card--selected" : ""}`}
              onClick={() => {
                const current = selectedColleges || ["gaming"];
                const next = current.includes(college.id)
                  ? current.filter((id) => id !== college.id)
                  : [...current, college.id];
                onSelectedCollegesChange(next);
              }}
              aria-pressed={selectedColleges?.includes(college.id)}
            >
              <span className="college-picker-card__label">{college.label}</span>
              <span className="college-picker-card__tagline">{college.tagline}</span>
              {!college.built && <span className="college-picker-card__badge">Coming soon</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Platform Preferences */}
      <section className="settings-card">
        <h2 className="settings-card__title">Platform Preferences</h2>
        <p className="settings-card__note">
          Drag to rank your most-used stores top to bottom — your wishlist price cards will
          show them left to right in this same order.
        </p>
        <ReorderableList
          items={platformOrder}
          onReorder={onPlatformOrderChange}
          renderItem={(storeName) => {
            const favicon = faviconFor(storeName);
            return (
              <>
                {favicon && <img src={favicon} alt="" />}
                {shortStoreName(storeName)}
              </>
            );
          }}
        />
      </section>

      {/* API Keys */}
      <section className="settings-card">
        <h2 className="settings-card__title">API Keys</h2>
        <p className="settings-card__note">
          Optional — both XBXprices and PlatPrices give every account a small free monthly
          quota. If a lot of people share this app's built-in keys, everyone splits the same
          quota. Plugging in your own free key here means your usage draws from your own
          quota instead. Leave blank to keep using the shared one.
        </p>

        <label className="api-key-field">
          <span>
            XBXprices key (Xbox pricing) —{" "}
            <a href="https://xbxprices.com" target="_blank" rel="noopener noreferrer">get a free key</a>
          </span>
          <input
            type="password"
            placeholder="Paste your XBXprices key"
            value={xbxpricesKey}
            onChange={(e) => onXbxpricesKeyChange(e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="api-key-field">
          <span>
            PlatPrices key (PlayStation pricing/trophies) —{" "}
            <a href="https://platprices.com/api-request" target="_blank" rel="noopener noreferrer">get a free key</a>
          </span>
          <input
            type="password"
            placeholder="Paste your PlatPrices key"
            value={platpricesKey}
            onChange={(e) => onPlatpricesKeyChange(e.target.value)}
            autoComplete="off"
          />
        </label>
      </section>

      {/* Add friends */}
      <section className="settings-card">
        <h2 className="settings-card__title">Add friends</h2>
        <p className="settings-card__note">
          Friends can add you by phone number, your Lykodex friend code, or by scanning your QR code.
          Your username can be changed any time — your friend code below never changes, so
          friends who've added you stay connected even if you rename yourself.
        </p>

        <div className="friend-code-row">
          <span className="friend-code-row__code">GD-4F9K-772X</span>
          <button type="button" className="linking-row__connect" onClick={() => setShowQr(!showQr)}>
            {showQr ? "Hide QR code" : "Show QR code"}
          </button>
        </div>

        {showQr && (
          <div className="qr-placeholder" role="img" aria-label="QR code for adding this Lykodex friend code">
            <div className="qr-placeholder__grid">
              {Array.from({ length: 49 }).map((_, i) => (
                <span key={i} className={i % 3 === 0 || i % 7 === 0 ? "is-dark" : ""} />
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="panel__status">Changes save automatically as you type.</p>
    </div>
  );
}
