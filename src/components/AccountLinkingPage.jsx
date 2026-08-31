// Account linking screen — connect gaming and streaming platforms.
//
// Genuinely working pieces: Discord + Twitch (real OAuth via
// Supabase's own built-in provider support — see lib/auth.js for why
// that one specifically isn't blocked on deployment the way a
// directly-registered OAuth app is: Supabase's OAuth callback is its
// own fixed domain, not ours), Xbox Live + PlayStation Network (both
// real, live-synced Gamerscore/trophy data, not self-reported), and
// Steam:
//   - Xbox: real Microsoft OAuth ("Sign in with Microsoft") -> Xbox
//     Live's own XSTS token exchange (see lib/xboxOAuth.js).
//   - PlayStation: a real npsso-token-based session (see
//     lib/psnAuth.js) — unofficial (Sony has no public OAuth app
//     registration path) but real, the same mechanism every PSN
//     trophy tracker uses.
//   - Steam: real "Sign in through Steam" (OpenID 2.0, see
//     lib/steamAuth.js) rather than the old "paste your SteamID64 and
//     we trust it" — Valve's OpenID provider proves real ownership
//     with no app registration needed at all, unlike everything else
//     on this page.
//
// Nintendo still has no public API for a person's own library at all
// (confirmed while researching it) — it keeps the real self-reported
// handle field pattern (Friend Code + Username) below; whichever of
// self-reported vs. real-linked data is actually available wins when
// Gaming Mastery recomputes (see lib/gameMasteryData.js).
//
// Removed entirely: Destiny 2 (real working Bungie OAuth, but paused
// on a Bungie-registered redirect URL — dropped from this screen per
// product decision, not because the code doesn't work), Riot Games,
// Epic Games, and Kick (none had a realistic path to real data for
// this project's scope).

import { useState, useEffect } from "react";
import { importSteamWishlist } from "../lib/wishlistImport";
import { linkIdentity, unlinkProviderIdentity, getLinkedProviders, syncDiscordLink, removeDiscordLink } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";
import { getXboxSignInUrl, startXboxSignIn, fetchLiveGamerscore, unlinkXbox } from "../lib/xboxOAuth";
import { linkPsnAccount, fetchLiveTrophies, unlinkPsn } from "../lib/psnAuth";
import { startSteamSignIn } from "../lib/steamAuth";
import { linkCrunchyrollAccount, fetchCrunchyrollLibrary, unlinkCrunchyroll } from "../lib/crunchyrollAuth";
import { importXboxLibrary, importPsnLibrary } from "../lib/libraryImport";
import { importCrunchyrollLibrary } from "../lib/mediaLibraryImport";
import { useApp } from "../hooks/useApp";
import GameMasterySection from "./GameMasterySection";

// fields is a list (not a single value) because Nintendo needs two —
// Friend Code AND Username — while other self-reported platforms
// might only need one; PlatformHandleCard below renders one input per
// field but saves/clears them together as a single "platform" unit.
//
// PlayStation's own self-reported "Online ID" entry used to live here
// too, but it was a confusing duplicate once real PSN linking (see
// PsnCard below) existed — a second "PlayStation" card on the same
// page, showing a self-reported handle with no relation to the real
// npsso-verified trophy link. Removed entirely; Nintendo is the only
// self-reported platform left since it still has no public API for a
// person's own library at all.
//
// hideRefresh: Nintendo has no Gaming Mastery contribution at all (see
// lib/gameMastery.js — only xbox/playstation/steam feed that score),
// so a "Refresh" button here would recompute Mastery from Xbox/PS/
// Steam data while implying it does something with the Nintendo
// fields, which it never did — misleading, so it's just not offered.
const HANDLE_PLATFORMS = [
  {
    id: "nintendo",
    label: "Nintendo",
    fields: [
      { id: "nintendo_friend_code", fieldLabel: "Friend Code", placeholder: "SW-0000-0000-0000" },
      { id: "nintendo_username", fieldLabel: "Username", placeholder: "Your Nintendo Account username" },
    ],
    hideRefresh: true,
  },
];

// Connected view matches OAuthProviderCard's look (a plain "Disconnect"
// button, no form) once every field the person has actually filled in
// is saved — same visual language as Discord/Twitch below, rather than
// leaving a filled-in save form sitting there looking unfinished.
function PlatformHandleCard({ platform, values: savedValues, onSaved, onRecomputeMastery }) {
  const initialFieldValues = {};
  platform.fields.forEach((f) => { initialFieldValues[f.id] = savedValues[f.id] || ""; });

  const isConnected = platform.fields.some((f) => savedValues[f.id]);
  const [editing, setEditing] = useState(!isConnected);
  const [fieldValues, setFieldValues] = useState(initialFieldValues);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [disconnecting, setDisconnecting] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  // savedValues arrives asynchronously (parent fetches the profile
  // after this card has already mounted with empty defaults) — sync
  // once the real values show up, without clobbering anything the
  // person's already typed, and drop out of edit mode once something
  // real is on file.
  useEffect(() => {
    const hasAny = platform.fields.some((f) => savedValues[f.id]);
    if (hasAny) {
      setFieldValues((prev) => {
        const next = { ...prev };
        platform.fields.forEach((f) => {
          if (savedValues[f.id]) next[f.id] = savedValues[f.id];
        });
        return next;
      });
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedValues]);

  async function handleSave(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      const toSave = {};
      platform.fields.forEach((f) => { toSave[f.id] = fieldValues[f.id]?.trim() || null; });
      await onSaved(toSave);
      setStatus("saved");
      setEditing(false);
    } catch (err) {
      console.error(`Failed to save ${platform.label} handle:`, err);
      setStatus("error");
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const cleared = {};
      platform.fields.forEach((f) => { cleared[f.id] = null; });
      await onSaved(cleared);
      setFieldValues(platform.fields.reduce((acc, f) => ({ ...acc, [f.id]: "" }), {}));
      setEditing(true);
    } catch (err) {
      console.error(`Failed to disconnect ${platform.label}:`, err);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    if (!onRecomputeMastery) return;
    setRecomputing(true);
    await onRecomputeMastery();
    setRecomputing(false);
  }

  if (!editing) {
    return (
      <div className="steam-link-card">
        <h2 className="settings-card__title">{platform.label}</h2>
        {platform.fields.map((f) => (
          fieldValues[f.id] && (
            <p className="settings-card__note" key={f.id}>{f.fieldLabel}: {fieldValues[f.id]}</p>
          )
        ))}
        <div className="backlog-card__actions">
          <button type="button" className="linking-row__connect" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? "Disconnecting…" : `Disconnect ${platform.label}`}
          </button>
          {!platform.hideRefresh && (
            <button
              type="button"
              className="linking-row__connect"
              onClick={handleRefresh}
              disabled={recomputing}
              title="Recompute your Gaming Mastery"
            >
              {recomputing ? "Refreshing…" : "↻ Refresh"}
            </button>
          )}
        </div>
        {platform.accountUrl && (
          <a
            href={platform.accountUrl(fieldValues)}
            target="_blank"
            rel="noopener noreferrer"
            className="ps-trophy-attribution"
          >
            {platform.accountLinkLabel}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">{platform.label}</h2>
      <form className="price-search" onSubmit={handleSave}>
        {platform.fields.map((f) => (
          <input
            key={f.id}
            className="price-search__input"
            type="text"
            placeholder={f.placeholder}
            value={fieldValues[f.id]}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
          />
        ))}
        <button type="submit" className="price-search__button" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save"}
        </button>
      </form>
      {status === "error" && <p className="panel__status panel__status--error">Couldn't save — try again.</p>}
    </div>
  );
}

function OAuthProviderCard({ label, provider, linkedProviders, onChanged }) {
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [message, setMessage] = useState("");
  const connected = linkedProviders.includes(provider);

  async function handleConnect() {
    setStatus("loading");
    setMessage("");
    try {
      const { url } = await linkIdentity(provider);
      if (url) window.location.href = url;
    } catch (err) {
      console.error(`${label} link failed:`, err);
      setStatus("error");
      setMessage(err.message || `Couldn't connect ${label} — try again in a moment.`);
    }
  }

  async function handleDisconnect() {
    setStatus("loading");
    try {
      await unlinkProviderIdentity(provider);
      if (provider === "discord") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await removeDiscordLink(user.id);
      }
      await onChanged();
      setStatus("idle");
    } catch (err) {
      console.error(`${label} unlink failed:`, err);
      setStatus("error");
      setMessage(err.message || `Couldn't disconnect ${label}.`);
    }
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">{label}</h2>
      {connected ? (
        <button type="button" className="linking-row__connect" onClick={handleDisconnect} disabled={status === "loading"}>
          {status === "loading" ? "Disconnecting…" : `Disconnect ${label}`}
        </button>
      ) : (
        <button
          type="button"
          className="price-search__button"
          onClick={handleConnect}
          disabled={status === "loading"}
          style={{ alignSelf: "flex-start" }}
        >
          {status === "loading" ? "Connecting…" : `Connect with ${label}`}
        </button>
      )}
      {message && <p className="panel__status panel__status--error">{message}</p>}
    </div>
  );
}

// Real Microsoft OAuth -> Xbox Live sign-in (see lib/xboxOAuth.js).
// checkStatus/liveData are populated by actually calling the
// gamerscore endpoint on mount (rather than trusting a locally-cached
// flag) since that's the only way to know the link is actually still
// valid, not just that it existed once.
function XboxLiveCard() {
  const { userId, xboxLinkStatus, xboxLinkResult, clearXboxLinkResult } = useApp();
  const [checkStatus, setCheckStatus] = useState("checking"); // checking | linked | unlinked
  const [liveData, setLiveData] = useState(null);
  const [unlinking, setUnlinking] = useState(false);
  const [importStatus, setImportStatus] = useState("idle"); // idle | importing | done | error
  const [importMessage, setImportMessage] = useState("");
  const signInUrl = getXboxSignInUrl();

  async function handleImportLibrary() {
    setImportStatus("importing");
    setImportMessage("");
    try {
      const { total, added } = await importXboxLibrary(userId, (current, totalCount) =>
        setImportMessage(`Importing… ${current} of ${totalCount}`)
      );
      setImportStatus("done");
      setImportMessage(`Added ${added} of ${total} games to your Backlog.`);
    } catch (err) {
      console.error("Xbox library import failed:", err);
      setImportStatus("error");
      setImportMessage(err.message || "Couldn't import your library right now.");
    }
  }

  async function checkLinked() {
    setCheckStatus("checking");
    try {
      const data = await fetchLiveGamerscore();
      setLiveData(data);
      setCheckStatus("linked");
    } catch {
      setCheckStatus("unlinked");
    }
  }

  useEffect(() => {
    checkLinked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Just came back from a real sign-in (xboxLinkStatus set in
  // AppContext.jsx's OAuth-callback effect) — re-check rather than
  // trusting the callback result alone, so the card's state matches
  // whatever fetchLiveGamerscore actually sees.
  useEffect(() => {
    if (xboxLinkStatus === "success" || xboxLinkStatus === "error") checkLinked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xboxLinkStatus]);

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await unlinkXbox();
      setCheckStatus("unlinked");
      setLiveData(null);
    } catch (err) {
      console.error("Failed to unlink Xbox:", err);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">Xbox Live</h2>
      {xboxLinkResult?.error && (
        <p className="panel__status panel__status--error">
          Sign-in failed: {xboxLinkResult.error}
          <button type="button" className="game-popup__close" onClick={clearXboxLinkResult} aria-label="Dismiss" style={{ marginLeft: "8px" }}>✕</button>
        </p>
      )}
      {checkStatus === "checking" && <p className="panel__status">Checking…</p>}
      {checkStatus === "linked" && (
        <>
          <p className="settings-card__note">
            Signed in{liveData?.gamertag ? ` as ${liveData.gamertag}` : ""} — real Gamerscore: <strong>{liveData?.gamerscore?.toLocaleString()}</strong>
          </p>
          <div className="backlog-card__actions">
            <button type="button" className="linking-row__connect" onClick={handleImportLibrary} disabled={importStatus === "importing"}>
              {importStatus === "importing" ? "Importing…" : "Import Library to Gaming Collection"}
            </button>
            <button type="button" className="linking-row__connect" onClick={handleUnlink} disabled={unlinking}>
              {unlinking ? "Disconnecting…" : "Disconnect Xbox Live"}
            </button>
          </div>
          {importMessage && (
            <p className={`panel__status ${importStatus === "error" ? "panel__status--error" : ""}`}>{importMessage}</p>
          )}
        </>
      )}
      {checkStatus === "unlinked" && (
        signInUrl ? (
          <button type="button" className="price-search__button" onClick={startXboxSignIn} style={{ alignSelf: "flex-start" }}>
            Sign in with Microsoft
          </button>
        ) : (
          <p className="panel__status">Xbox sign-in isn't configured yet.</p>
        )
      )}
    </div>
  );
}

// Real npsso-token-based PSN session (see lib/psnAuth.js). The npsso
// itself is never stored by this app — sent once to complete linking,
// then only the resulting access/refresh tokens live server-side.
function PsnCard() {
  const { userId } = useApp();
  const [checkStatus, setCheckStatus] = useState("checking"); // checking | linked | unlinked
  const [trophies, setTrophies] = useState(null);
  const [npsso, setNpsso] = useState("");
  const [linkStatus, setLinkStatus] = useState("idle"); // idle | linking | error
  const [linkError, setLinkError] = useState("");
  const [unlinking, setUnlinking] = useState(false);
  const [importStatus, setImportStatus] = useState("idle"); // idle | importing | done | error
  const [importMessage, setImportMessage] = useState("");

  async function handleImportLibrary() {
    setImportStatus("importing");
    setImportMessage("");
    try {
      const { total, added } = await importPsnLibrary(userId, (current, totalCount) =>
        setImportMessage(`Importing… ${current} of ${totalCount}`)
      );
      setImportStatus("done");
      setImportMessage(`Added ${added} of ${total} games to your Backlog.`);
    } catch (err) {
      console.error("PSN library import failed:", err);
      setImportStatus("error");
      setImportMessage(err.message || "Couldn't import your library right now.");
    }
  }

  async function checkLinked() {
    setCheckStatus("checking");
    try {
      const { trophies: t } = await fetchLiveTrophies();
      setTrophies(t);
      setCheckStatus("linked");
    } catch {
      setCheckStatus("unlinked");
    }
  }

  useEffect(() => {
    checkLinked();
  }, []);

  async function handleLink(e) {
    e.preventDefault();
    if (!npsso.trim()) return;
    setLinkStatus("linking");
    setLinkError("");
    try {
      const { trophies: t } = await linkPsnAccount(npsso.trim());
      setTrophies(t);
      setCheckStatus("linked");
      setNpsso("");
      setLinkStatus("idle");
    } catch (err) {
      console.error("Failed to link PSN:", err);
      setLinkStatus("error");
      setLinkError(err.message || "Couldn't link — check your npsso token and try again.");
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await unlinkPsn();
      setCheckStatus("unlinked");
      setTrophies(null);
    } catch (err) {
      console.error("Failed to unlink PSN:", err);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">PlayStation Network</h2>
      {checkStatus === "checking" && <p className="panel__status">Checking…</p>}
      {checkStatus === "linked" && trophies && (
        <>
          <p className="settings-card__note">
            Real trophy counts: <strong>{trophies.platinum}</strong> platinum, <strong>{trophies.gold}</strong> gold, <strong>{trophies.silver}</strong> silver, <strong>{trophies.bronze}</strong> bronze.
          </p>
          <div className="backlog-card__actions">
            <button type="button" className="linking-row__connect" onClick={handleImportLibrary} disabled={importStatus === "importing"}>
              {importStatus === "importing" ? "Importing…" : "Import Library to Gaming Collection"}
            </button>
            <button type="button" className="linking-row__connect" onClick={handleUnlink} disabled={unlinking}>
              {unlinking ? "Disconnecting…" : "Disconnect PlayStation"}
            </button>
          </div>
          {importMessage && (
            <p className={`panel__status ${importStatus === "error" ? "panel__status--error" : ""}`}>{importMessage}</p>
          )}
        </>
      )}
      {checkStatus === "unlinked" && (
        <>
          <p className="settings-card__note" style={{ fontSize: "11px" }}>
            Sony doesn't offer public sign-in for this, so linking uses your own npsso session token instead — the same method every PSN trophy tracker uses. Sign into{" "}
            <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer">this Sony page</a>{" "}
            in a new tab while logged into PSN, then copy the 64-character value between the quotes and paste it below. Treat it like a password — never share it anywhere else.
          </p>
          <form className="price-search" onSubmit={handleLink}>
            <input
              className="price-search__input"
              type="text"
              placeholder="Paste your npsso token"
              value={npsso}
              onChange={(e) => setNpsso(e.target.value)}
            />
            <button type="submit" className="price-search__button" disabled={linkStatus === "linking"}>
              {linkStatus === "linking" ? "Linking…" : "Link PlayStation"}
            </button>
          </form>
          {linkStatus === "error" && <p className="panel__status panel__status--error">{linkError}</p>}
        </>
      )}
    </div>
  );
}

// Real Crunchyroll linking — Crunchyroll has no public API or OAuth
// sign-in at all, so this uses the person's own etp_rt session cookie
// (see lib/crunchyrollAuth.js) the same way PSN linking uses an
// npsso token — unofficial but real, confirmed against
// HarshitKumar9030/crunchyroll-api's actual working implementation.
function CrunchyrollCard() {
  const { userId } = useApp();
  const [checkStatus, setCheckStatus] = useState("checking"); // checking | linked | unlinked
  const [titleCount, setTitleCount] = useState(null);
  const [cookieInput, setCookieInput] = useState("");
  const [linkStatus, setLinkStatus] = useState("idle"); // idle | linking | error
  const [linkError, setLinkError] = useState("");
  const [unlinking, setUnlinking] = useState(false);
  const [importStatus, setImportStatus] = useState("idle"); // idle | importing | done | error
  const [importMessage, setImportMessage] = useState("");

  async function handleImportLibrary() {
    setImportStatus("importing");
    setImportMessage("");
    try {
      const { total, added } = await importCrunchyrollLibrary(userId, (current, totalCount) =>
        setImportMessage(`Importing… ${current} of ${totalCount}`)
      );
      setImportStatus("done");
      setImportMessage(`Added ${added} of ${total} titles to your Library Collection.`);
    } catch (err) {
      console.error("Crunchyroll library import failed:", err);
      setImportStatus("error");
      setImportMessage(err.message || "Couldn't import your watch history right now.");
    }
  }

  async function checkLinked() {
    setCheckStatus("checking");
    try {
      const { titles } = await fetchCrunchyrollLibrary();
      setTitleCount(titles.length);
      setCheckStatus("linked");
    } catch {
      setCheckStatus("unlinked");
    }
  }

  useEffect(() => {
    checkLinked();
  }, []);

  async function handleLink(e) {
    e.preventDefault();
    if (!cookieInput.trim()) return;
    setLinkStatus("linking");
    setLinkError("");
    try {
      await linkCrunchyrollAccount(cookieInput.trim());
      setCookieInput("");
      setLinkStatus("idle");
      await checkLinked();
    } catch (err) {
      console.error("Failed to link Crunchyroll:", err);
      setLinkStatus("error");
      setLinkError(err.message || "Couldn't link — check your cookie is fresh and try again.");
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await unlinkCrunchyroll();
      setCheckStatus("unlinked");
      setTitleCount(null);
    } catch (err) {
      console.error("Failed to unlink Crunchyroll:", err);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">Crunchyroll</h2>
      {checkStatus === "checking" && <p className="panel__status">Checking…</p>}
      {checkStatus === "linked" && (
        <>
          <p className="settings-card__note">
            Linked — <strong>{titleCount}</strong> titles in your real watch history.
          </p>
          <div className="backlog-card__actions">
            <button type="button" className="linking-row__connect" onClick={handleImportLibrary} disabled={importStatus === "importing"}>
              {importStatus === "importing" ? "Importing…" : "Import Library to Library Collection"}
            </button>
            <button type="button" className="linking-row__connect" onClick={handleUnlink} disabled={unlinking}>
              {unlinking ? "Disconnecting…" : "Disconnect Crunchyroll"}
            </button>
          </div>
          {importMessage && (
            <p className={`panel__status ${importStatus === "error" ? "panel__status--error" : ""}`}>{importMessage}</p>
          )}
        </>
      )}
      {checkStatus === "unlinked" && (
        <>
          <p className="settings-card__note" style={{ fontSize: "11px" }}>
            Crunchyroll doesn't offer public sign-in for this, so linking uses your own session
            cookie instead. Sign into{" "}
            <a href="https://www.crunchyroll.com" target="_blank" rel="noopener noreferrer">crunchyroll.com</a>{" "}
            in a new tab, open your browser's DevTools → Application/Storage → Cookies →
            crunchyroll.com, find the <code>etp_rt</code> cookie, and paste{" "}
            <code>etp_rt=&lt;its value&gt;</code> below. Treat it like a password — never share it
            anywhere else.
          </p>
          <form className="price-search" onSubmit={handleLink}>
            <input
              className="price-search__input"
              type="text"
              placeholder="etp_rt=..."
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
            />
            <button type="submit" className="price-search__button" disabled={linkStatus === "linking"}>
              {linkStatus === "linking" ? "Linking…" : "Link Crunchyroll"}
            </button>
          </form>
          {linkStatus === "error" && <p className="panel__status panel__status--error">{linkError}</p>}
        </>
      )}
    </div>
  );
}

export default function AccountLinkingPage({
  variant = "settings",
  onFinishOnboarding,
  userId,
  linkedSteamId,
  onUnlinkSteam,
  onAddToWishlist,
  masteryScore,
  masteryXp,
  masteryLevel,
  masteryBreakdown,
  masteryComputedAt,
  onRecomputeMastery,
}) {
  const { steamLinkResult, clearSteamLinkResult } = useApp();
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  // Self-reported Nintendo handle — real reference info the person
  // saves themselves, no public API to sync from (see
  // PlatformHandleCard above and platform_handles in schema.sql).
  const [handles, setHandles] = useState({});
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("nintendo_friend_code, nintendo_username")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load platform handles:", error); return; }
        setHandles(data || {});
      });
  }, [userId]);

  // Takes a { fieldId: value|null } object rather than a single field —
  // Nintendo saves/clears two columns (friend code + username) as one
  // unit, in a single round trip.
  async function saveHandles(fieldValues) {
    const { error } = await supabase
      .from("profiles")
      .update(fieldValues)
      .eq("id", userId);
    if (error) throw error;
    setHandles((prev) => ({ ...prev, ...fieldValues }));
  }

  // Discord/Twitch — real Supabase-native OAuth linking, NOT blocked
  // on deployment (see the file header comment for why).
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);

  async function refreshLinkedProviders() {
    try {
      const providers = await getLinkedProviders();
      setLinkedProviders(providers);
      if (providers.includes("discord")) {
        await syncDiscordLink();
      }
    } catch (err) {
      console.error("Failed to load linked providers:", err);
    } finally {
      setProvidersLoaded(true);
    }
  }

  useEffect(() => {
    refreshLinkedProviders();
  }, []);

  // Linking itself now happens via real "Sign in through Steam" (see
  // AppContext.jsx's Steam completion effect) — this just imports the
  // wishlist for an already-linked account, same as Xbox/PSN's
  // separate explicit "Import Library" buttons rather than bundling
  // import into the link step itself.
  async function handleImportWishlist() {
    setStatus("loading");
    setMessage("");

    try {
      const { total, added } = await importSteamWishlist(
        linkedSteamId,
        onAddToWishlist,
        (current, totalCount) => setMessage(`Importing… ${current} of ${totalCount}`)
      );
      setStatus("done");
      setMessage(`Imported ${added} of ${total} games from your Steam wishlist.`);
    } catch (err) {
      console.error("Steam wishlist import failed:", err);
      setStatus("error");
      setMessage(err.message || "Couldn't import your Steam wishlist — make sure it's set to public.");
    }
  }

  const isOnboarding = variant === "onboarding";

  return (
    <div className={`linking-page${isOnboarding ? " linking-page--onboarding" : ""}`}>
      <div className="linking-page__head">
        <h1 className="linking-page__title">
          {isOnboarding ? "Connect your accounts (optional)" : "Connect your accounts"}
        </h1>
        <p className="linking-page__subtitle">
          {isOnboarding
            ? "Link Steam, Discord, or Twitch now — or skip and finish this later in Account Settings."
            : "Link the platforms you play and stream on so Lykodex can pull in your library, achievements, and friends."}
        </p>
      </div>

      <div className="steam-link-card">
        <h2 className="settings-card__title">Steam</h2>
        {steamLinkResult?.error && (
          <p className="panel__status panel__status--error">
            Sign-in failed: {steamLinkResult.error}
            <button type="button" className="game-popup__close" onClick={clearSteamLinkResult} aria-label="Dismiss" style={{ marginLeft: "8px" }}>✕</button>
          </p>
        )}
        {linkedSteamId ? (
          <>
            <p className="settings-card__note">
              Linked — SteamID64 <code>{linkedSteamId}</code>. Import your wishlist any time below, or
              head to the Prices page and hit "Resync Steam wishlist" to pull in new additions.
            </p>
            <div className="backlog-card__actions">
              <button type="button" className="linking-row__connect" onClick={handleImportWishlist} disabled={status === "loading"}>
                {status === "loading" ? "Importing…" : "Import Steam Wishlist"}
              </button>
              <button type="button" className="linking-row__connect" onClick={onUnlinkSteam}>
                Unlink Steam
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="settings-card__note">
              Sign in through Steam to link your real account — your wishlist needs to be set to
              public on Steam afterward for it to sync.
            </p>
            <button type="button" className="price-search__button" onClick={startSteamSignIn} style={{ alignSelf: "flex-start" }}>
              Sign in through Steam
            </button>
          </>
        )}
        {message && (
          <p className={`panel__status ${status === "error" ? "panel__status--error" : ""}`}>{message}</p>
        )}
      </div>

      {onRecomputeMastery && (
        <GameMasterySection
          userId={userId}
          linkedSteamId={linkedSteamId}
          masteryScore={masteryScore}
          masteryXp={masteryXp}
          masteryLevel={masteryLevel}
          masteryBreakdown={masteryBreakdown}
          masteryComputedAt={masteryComputedAt}
          onRecomputeMastery={onRecomputeMastery}
        />
      )}

      {!isOnboarding && (
        <>
          <PsnCard />
          <XboxLiveCard />
          <CrunchyrollCard />
        </>
      )}

      {!isOnboarding && HANDLE_PLATFORMS.map((platform) => (
        <PlatformHandleCard
          key={platform.id}
          platform={platform}
          values={handles}
          onSaved={saveHandles}
          onRecomputeMastery={onRecomputeMastery}
        />
      ))}

      {providersLoaded && (
        <>
          <OAuthProviderCard
            label="Discord"
            provider="discord"
            linkedProviders={linkedProviders}
            onChanged={refreshLinkedProviders}
          />
          <OAuthProviderCard
            label="Twitch"
            provider="twitch"
            linkedProviders={linkedProviders}
            onChanged={refreshLinkedProviders}
          />
          {/* Google/Apple cards hidden for now — same deferred
              external-setup reason as LoginPage.jsx's oauthProviders
              list. Re-add here once that infrastructure is done. */}
        </>
      )}

      {isOnboarding && (
        <div className="onboarding-actions">
          <button type="button" className="auth-form__submit" onClick={onFinishOnboarding}>
            Continue to Lykodex
          </button>
          <button type="button" className="auth-form__secondary" onClick={onFinishOnboarding}>
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
