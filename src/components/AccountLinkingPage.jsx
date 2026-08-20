// Account linking screen — connect gaming and streaming platforms.
//
// Genuinely working pieces: Steam (public-profile wishlist sync), and
// Discord + Twitch (real OAuth via Supabase's own built-in provider
// support — see lib/auth.js for why that one specifically isn't
// blocked on deployment the way a directly-registered OAuth app is:
// Supabase's OAuth callback is its own fixed domain, not ours).
//
// Xbox/PlayStation/Nintendo have no public API for a person's own
// library/achievements/trophies at all — confirmed while researching
// each one, not an oversight. Rather than a dead "not available" row,
// each gets a real self-reported handle field (their actual Gamertag/
// Online ID/Friend Code) — honest reference info a person can save
// themselves, never presented as verified or live-synced. The scored
// numbers (Gamerscore, PS trophy counts) are entered separately below
// in GameMasterySection, which already has its own real "Recompute"
// action — the small refresh button next to each handle here just
// calls that same recompute, it isn't a second, different mechanism.
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
import GameMasterySection from "./GameMasterySection";

// accountUrl, where present, is a real, verified destination for
// finding the actual Gamerscore/trophy numbers typed into
// GameMasterySection below — confirmed live, not guessed:
//   - Xbox: account.xbox.com/en-us/profile is Microsoft's own
//     sign-in-gated "your profile" page; passing the saved Gamertag
//     takes it straight there instead of a bare landing page.
//   - PlayStation: my.playstation.com's old direct profile/trophy URLs
//     are dead (redirect straight to the PlayStation homepage now,
//     confirmed live) — library.playstation.com is Sony's real current
//     sign-in-gated web app and the honest destination; no trophies
//     sub-path could be verified working, so this links to the library
//     root rather than guess one.
//   - Nintendo has no equivalent self-service stats page at all, so no
//     accountUrl here.
const HANDLE_PLATFORMS = [
  {
    id: "xbox_gamertag",
    label: "Xbox",
    fieldLabel: "Gamertag",
    placeholder: "Your Xbox Gamertag",
    accountUrl: (value) =>
      value
        ? `https://account.xbox.com/en-us/profile?gamertag=${encodeURIComponent(value)}`
        : "https://account.xbox.com/en-us/profile",
    accountLinkLabel: "Find your Gamerscore on Xbox →",
  },
  {
    id: "playstation_online_id",
    label: "PlayStation",
    fieldLabel: "Online ID",
    placeholder: "Your PSN Online ID",
    accountUrl: () => "https://library.playstation.com",
    accountLinkLabel: "Open your PlayStation Library →",
  },
  { id: "nintendo_friend_code", label: "Nintendo", fieldLabel: "Friend Code", placeholder: "SW-0000-0000-0000" },
];

function PlatformHandleCard({ platform, value: initialValue, onSaved, onRecomputeMastery }) {
  const [value, setValue] = useState(initialValue || "");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [recomputing, setRecomputing] = useState(false);

  // initialValue arrives asynchronously (parent fetches the profile
  // after this card has already mounted with an empty default) — sync
  // once the real value shows up, without clobbering anything the
  // person's already typed.
  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  async function handleSave(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      await onSaved(platform.id, value.trim());
      setStatus("saved");
    } catch (err) {
      console.error(`Failed to save ${platform.label} handle:`, err);
      setStatus("error");
    }
  }

  async function handleRefresh() {
    if (!onRecomputeMastery) return;
    setRecomputing(true);
    await onRecomputeMastery();
    setRecomputing(false);
  }

  return (
    <div className="steam-link-card">
      <h2 className="settings-card__title">{platform.label}</h2>
      <form className="price-search" onSubmit={handleSave}>
        <input
          className="price-search__input"
          type="text"
          placeholder={platform.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="price-search__button" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : `Save ${platform.fieldLabel}`}
        </button>
        <button
          type="button"
          className="linking-row__connect"
          onClick={handleRefresh}
          disabled={recomputing}
          title="Recompute your Gaming Mastery"
        >
          {recomputing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </form>
      {status === "error" && <p className="panel__status panel__status--error">Couldn't save — try again.</p>}
      {platform.accountUrl && (
        <a
          href={platform.accountUrl(value)}
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

export default function AccountLinkingPage({
  userId,
  linkedSteamId,
  onLinkSteam,
  onUnlinkSteam,
  onAddToWishlist,
  masteryScore,
  masteryXp,
  masteryLevel,
  masteryBreakdown,
  masteryComputedAt,
  onRecomputeMastery,
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [message, setMessage] = useState("");

  // Self-reported Xbox/PlayStation/Nintendo handles — real reference
  // info the person saves themselves, no API to sync from for any of
  // the three. See PlatformHandleCard above and platform_handles in
  // schema.sql.
  const [handles, setHandles] = useState({});
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("xbox_gamertag, playstation_online_id, nintendo_friend_code")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load platform handles:", error); return; }
        setHandles(data || {});
      });
  }, [userId]);

  async function saveHandle(fieldId, value) {
    const { error } = await supabase
      .from("profiles")
      .update({ [fieldId]: value || null })
      .eq("id", userId);
    if (error) throw error;
    setHandles((prev) => ({ ...prev, [fieldId]: value }));
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

  async function handleLink(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setStatus("loading");
    setMessage("");

    try {
      const { steamId, total, added } = await importSteamWishlist(
        input.trim(),
        onAddToWishlist,
        (current, totalCount) => setMessage(`Importing… ${current} of ${totalCount}`)
      );
      onLinkSteam(steamId);
      setStatus("done");
      setMessage(`Linked and imported ${added} of ${total} games from your Steam wishlist.`);
      setInput("");
    } catch (err) {
      console.error("Steam link failed:", err);
      setStatus("error");
      setMessage(err.message || "Couldn't link that Steam profile — make sure your wishlist is public.");
    }
  }

  return (
    <div className="linking-page">
      <div className="linking-page__head">
        <h1 className="linking-page__title">Connect your accounts</h1>
        <p className="linking-page__subtitle">
          Link the platforms you play and stream on so Lykodex can pull in your library, achievements, and friends.
        </p>
      </div>

      <div className="steam-link-card">
        <h2 className="settings-card__title">Steam wishlist sync</h2>
        {linkedSteamId ? (
          <>
            <p className="settings-card__note">
              Linked — SteamID64 <code>{linkedSteamId}</code>. Your wishlist stays synced; head to the
              Prices page any time and hit "Resync Steam wishlist" to pull in new additions.
            </p>
            <button type="button" className="linking-row__connect" onClick={onUnlinkSteam}>
              Unlink Steam
            </button>
          </>
        ) : (
          <>
            <p className="settings-card__note">
              Paste your Steam profile URL, SteamID64, or vanity name — your wishlist needs to be
              set to public on Steam for this to work.
            </p>
            <form className="price-search" onSubmit={handleLink}>
              <input
                className="price-search__input"
                type="text"
                placeholder="steamcommunity.com/id/yourname"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" className="price-search__button" disabled={status === "loading"}>
                {status === "loading" ? "Linking…" : "Link & import"}
              </button>
            </form>
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
        </>
      )}

      {HANDLE_PLATFORMS.map((platform) => (
        <PlatformHandleCard
          key={platform.id}
          platform={platform}
          value={handles[platform.id]}
          onSaved={saveHandle}
          onRecomputeMastery={onRecomputeMastery}
        />
      ))}
    </div>
  );
}
