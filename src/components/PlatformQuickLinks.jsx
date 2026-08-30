// Shared gaming-platform icon links + mastery refresh — used on the
// Gaming dashboard profile heading and the Overview stock chart.

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { playstationProfileUrl, steamProfileUrl, xboxProfileUrl } from "../lib/platformAccounts";

function PlatformBrandIcon({ src }) {
  return <img src={src} alt="" width={32} height={32} decoding="async" />;
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
      <polyline points="21 3 21 9 15 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const GAMING_PLATFORMS = [
  {
    id: "steam",
    label: "Steam",
    iconSrc: "/icons/platforms/steam.svg",
    className: "overview-platform-bar__link--steam",
    isLinked: ({ linkedSteamId }) => Boolean(linkedSteamId),
    profileUrl: ({ linkedSteamId }) => steamProfileUrl(linkedSteamId),
    linkPrompt: "Link Steam",
  },
  {
    id: "xbox",
    label: "Xbox",
    iconSrc: "/icons/platforms/xbox.svg",
    className: "overview-platform-bar__link--xbox",
    // Real Xbox Live sign-in (xbox_tokens) replaced the old
    // self-reported xbox_gamertag field — see is_xbox_linked() RPC
    // (xbox_tokens has no client-readable RLS policy at all, service_
    // role only, so this narrow status-only check is how the client
    // learns "is MY account linked" without touching token values).
    isLinked: ({ handles }) => Boolean(handles.xboxLinked),
    // Falls back to the bare (non-personalized) profile URL when
    // linked but no gamertag is on file (real Xbox Live sign-in
    // doesn't write to the old self-reported field it replaced) —
    // without this, `url` would be null and the icon would render as
    // "not linked" despite genuinely being linked.
    profileUrl: ({ handles }) => xboxProfileUrl(handles.xboxGamertag) || "https://account.xbox.com/en-us/profile",
    linkPrompt: "Sign in with Microsoft",
  },
  {
    id: "playstation",
    label: "PlayStation",
    iconSrc: "/icons/platforms/playstation.svg",
    className: "overview-platform-bar__link--playstation",
    // Real PSN trophy sync (psn_tokens) is the primary signal now —
    // same is_psn_linked() RPC reasoning as Xbox above. The old
    // self-reported playstation_online_id field is still a real,
    // separate thing (just a handle, not proof of a real PSN link),
    // so it's kept as a fallback for the profile-link destination
    // only, not for "is this linked" status.
    isLinked: ({ handles }) => Boolean(handles.psnLinked),
    profileUrl: () => playstationProfileUrl(),
    linkPrompt: "Link PlayStation",
  },
];

export function usePlatformHandles(userId) {
  const [handles, setHandles] = useState({});

  useEffect(() => {
    if (!userId) {
      setHandles({});
      return;
    }
    Promise.all([
      supabase.from("profiles").select("xbox_gamertag, playstation_online_id").eq("id", userId).single(),
      supabase.rpc("is_xbox_linked"),
      supabase.rpc("is_psn_linked"),
    ]).then(([profileRes, xboxRes, psnRes]) => {
      if (profileRes.error) {
        console.error("Failed to load platform handles:", profileRes.error);
        return;
      }
      setHandles({
        xboxGamertag: profileRes.data?.xbox_gamertag,
        playstationOnlineId: profileRes.data?.playstation_online_id,
        xboxLinked: Boolean(xboxRes.data),
        psnLinked: Boolean(psnRes.data),
      });
    });
  }, [userId]);

  return handles;
}

export function PlatformQuickLinks({
  userId,
  linkedSteamId,
  onGoToLinking,
  className = "overview-platform-bar__links",
  linkClassName = "overview-platform-bar__link",
}) {
  const handles = usePlatformHandles(userId);
  const context = { linkedSteamId, handles };

  return (
    <div className={className} role="list" aria-label="Linked gaming accounts">
      {GAMING_PLATFORMS.map((platform) => {
        const linked = platform.isLinked(context);
        const url = linked ? platform.profileUrl(context) : null;
        const itemClassName = `${linkClassName} ${platform.className} overview-platform-bar__link--brand ${linked ? `${linkClassName}--active` : ""}`;
        const icon = <PlatformBrandIcon src={platform.iconSrc} />;

        if (linked && url) {
          return (
            <a
              key={platform.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClassName}
              role="listitem"
              title={`Open ${platform.label} profile`}
              aria-label={`${platform.label} profile`}
            >
              {icon}
            </a>
          );
        }

        return (
          <button
            key={platform.id}
            type="button"
            className={itemClassName}
            role="listitem"
            title={platform.linkPrompt}
            aria-label={platform.linkPrompt}
            onClick={onGoToLinking}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

export function MasteryRefreshButton({
  linkedSteamId,
  onRecomputeMastery,
  onRefreshed,
  className = "overview-platform-bar__refresh",
  showLabel = true,
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRecomputeMastery) return;
    setRefreshing(true);
    try {
      await onRecomputeMastery(linkedSteamId);
      onRefreshed?.();
    } catch (err) {
      console.error("Mastery refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleRefresh}
      disabled={refreshing || !onRecomputeMastery}
      title="Refresh Steam achievements and recalculate mastery from saved Gamerscore / trophy counts"
      aria-label="Refresh gaming mastery data"
    >
      <RefreshIcon />
      {showLabel && (
        <span className="overview-platform-bar__refresh-label">
          {refreshing ? "Refreshing…" : "Refresh"}
        </span>
      )}
    </button>
  );
}
