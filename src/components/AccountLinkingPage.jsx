// Account linking screen — connect gaming and streaming platforms.
//
// Genuinely working pieces: Steam (public-profile wishlist sync),
// Destiny 2 (real Bungie OAuth, paused until deployed — needs a real
// public redirect URL registered with Bungie directly), and now
// Discord + Twitch (real OAuth via Supabase's own built-in provider
// support — see lib/auth.js for why that one specifically ISN'T
// blocked on deployment the way Destiny 2 is: Supabase's OAuth
// callback is its own fixed domain, not ours).
//
// Everything else below is an honest "not available" listing, updated
// with what this project actually found out researching each one
// (Riot's RSO needs their manual approval — not simply a self-service
// key the way the label used to imply; Xbox's real API is gated
// behind being an approved game developer, not open to companion
// apps; PlayStation and Nintendo have no public API at all).

import { useState, useEffect } from "react";
import { importSteamWishlist } from "../lib/wishlistImport";
import { checkBungieStatus, connectBungie, disconnectBungie } from "../lib/bungie";
import { linkIdentity, unlinkProviderIdentity, getLinkedProviders, syncDiscordLink, removeDiscordLink } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";
import GameMasterySection from "./GameMasterySection";

const platforms = [
  { name: "Xbox", support: "No self-service API", note: "The real Xbox Live API is gated behind Microsoft's ID@Xbox / Creators Program — for approved game developers, not companion apps like this one." },
  { name: "PlayStation", support: "No public API", note: "Sony has never published a public API for this, official or otherwise — nothing to apply for." },
  { name: "Riot Games", support: "Gated by Riot", note: "League/Valorant access (RSO) needs Riot's manual review and approval, not a self-service key — not guaranteed for a project this size." },
  { name: "Epic Games", support: "Limited", note: "Friends-list access is generally restricted to Epic-built titles." },
  { name: "Nintendo", support: "No public API", note: "No public API currently available." },
  { name: "Kick", support: "Limited", note: "Newer platform API — functionality may change as it matures." },
];

const supportStyles = {
  "Full support": "tag--support-full",
  "Identity only": "tag--support-partial",
  "Limited": "tag--support-partial",
  "Gated by Riot": "tag--support-partial",
  "No public API": "tag--support-none",
  "No self-service API": "tag--support-none",
};

function OAuthProviderCard({ label, provider, note, linkedProviders, onChanged }) {
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
      setMessage(err.message || `Couldn't connect ${label} — check it's enabled in Supabase's provider settings.`);
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
      <p className="settings-card__note">{note}</p>
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

  // Bungie/Destiny 2 — real OAuth, but blocked on deployment (needs
  // our own real public redirect URL registered directly with
  // Bungie). See api/bungie.js for the full flow (merged with the old bungie-auth.js).
  const [bungieStatus, setBungieStatus] = useState("checking"); // checking | connected | disconnected | no_key
  useEffect(() => {
    checkBungieStatus()
      .then((connected) => setBungieStatus(connected ? "connected" : "disconnected"))
      .catch(() => setBungieStatus("disconnected"));
  }, []);

  async function handleBungieDisconnect() {
    await disconnectBungie();
    setBungieStatus("disconnected");
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

      <div className="steam-link-card">
        <h2 className="settings-card__title">Destiny 2 (Eververse store)</h2>
        <p className="settings-card__note">
          Real OAuth login through Bungie — paused until this app is deployed, since Bungie needs a
          real public redirect URL registered directly with them (unlike Discord/Twitch below).
        </p>
        {bungieStatus === "connected" && (
          <button type="button" className="linking-row__connect" onClick={handleBungieDisconnect}>
            Disconnect Destiny 2
          </button>
        )}
        {bungieStatus === "disconnected" && (
          <button type="button" className="price-search__button" onClick={connectBungie} style={{ alignSelf: "flex-start" }}>
            Connect with Bungie
          </button>
        )}
        {bungieStatus === "checking" && <p className="panel__status">Checking connection…</p>}
      </div>

      {providersLoaded && (
        <>
          <OAuthProviderCard
            label="Discord"
            provider="discord"
            note="Real OAuth via Supabase — needs Discord enabled in Supabase's Authentication > Providers settings first."
            linkedProviders={linkedProviders}
            onChanged={refreshLinkedProviders}
          />
          <OAuthProviderCard
            label="Twitch"
            provider="twitch"
            note="Real OAuth via Supabase — needs Twitch enabled in Supabase's Authentication > Providers settings first."
            linkedProviders={linkedProviders}
            onChanged={refreshLinkedProviders}
          />
        </>
      )}

      <div className="linking-list">
        {platforms.map((p) => (
          <div key={p.name} className="linking-row linking-row--disabled">
            <div className="linking-row__identity">
              <span className="linking-row__name">{p.name}</span>
              <span className={`tag ${supportStyles[p.support]}`}>{p.support}</span>
            </div>
            <p className="linking-row__note">{p.note}</p>
            <button type="button" className="linking-row__connect" disabled>
              Not available
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
