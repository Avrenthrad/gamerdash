// Real "Now Playing" / online status for Xbox Live + PlayStation
// Network — see lib/xboxOAuth.js's fetchLiveXboxPresence and
// lib/psnAuth.js's fetchLivePsnPresence (both confirmed against real,
// working community library implementations, same as the Gamerscore/
// trophy sync this reuses the link for).
//
// Self only for now, deliberately — unlike SteamPresenceCard.jsx's
// friends slides, showing a FRIEND's Xbox/PSN presence would need a
// friend-scoped server-side check (xbox_tokens/psn_tokens have no
// client-readable RLS at all, service_role only) that doesn't exist
// yet. This is a real, scoped-down first version, not a stand-in for
// that — see HANDOFF.md if picking this up to extend it.

import { useEffect, useState } from "react";
import { fetchLiveXboxPresence } from "../lib/xboxOAuth";
import { fetchLivePsnPresence } from "../lib/psnAuth";
import SlidingBanner from "./SlidingBanner";

function PresenceSlide({ entry }) {
  const { platformLabel, online, playing } = entry;

  return (
    <div className={`presence-card ${playing ? "presence-card--playing" : ""}`}>
      <span className="presence-card__icon" aria-hidden="true">
        {entry.platform === "xbox" ? "🎮" : "🕹️"}
      </span>
      <span
        className={`presence-card__dot presence-card__dot--${playing ? "playing" : online ? "online" : "offline"}`}
        aria-hidden="true"
      />
      <div className="presence-card__body">
        {playing ? (
          <>
            <span className="presence-card__title">You · Playing {playing.name}</span>
            <span className="presence-card__meta">via {platformLabel} · right now</span>
          </>
        ) : (
          <>
            <span className="presence-card__title">You · {online ? "Online" : "Offline"} on {platformLabel}</span>
            <span className="presence-card__meta">{online ? "Not currently in a game" : "No recent activity"}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function GamingPresenceCard({ userId }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    setStatus("loading");

    Promise.allSettled([fetchLiveXboxPresence(), fetchLivePsnPresence()])
      .then(([xboxResult, psnResult]) => {
        const slides = [];
        if (xboxResult.status === "fulfilled") {
          slides.push({ id: "xbox-self", platform: "xbox", platformLabel: "Xbox", ...xboxResult.value });
        }
        if (psnResult.status === "fulfilled") {
          slides.push({ id: "psn-self", platform: "playstation", platformLabel: "PlayStation", ...psnResult.value });
        }
        // Playing first, then online, then offline — same rank logic
        // SteamPresenceCard.jsx uses.
        slides.sort((a, b) => {
          const rank = (e) => (e.playing ? 0 : e.online ? 1 : 2);
          return rank(a) - rank(b);
        });
        setEntries(slides);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load Xbox/PSN presence:", err);
        setStatus("error");
      });
  }, [userId]);

  if (!userId || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="presence-card presence-card--empty">
        <p className="panel__status">Checking Xbox/PlayStation status…</p>
      </div>
    );
  }

  if (status === "error" || entries.length === 0) return null;

  return (
    <SlidingBanner
      items={entries}
      getItemKey={(entry) => entry.id}
      renderItem={(entry) => <PresenceSlide entry={entry} />}
    />
  );
}
