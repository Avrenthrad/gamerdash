// Friends — combines real Steam friends + live activity with the
// linked account's own achievement-based progress (formerly its own
// "Game Progress Tracker" dashboard, merged in here).
//
// Everything on this panel is real data once a Steam account is
// linked: live online/in-game status (GetPlayerSummaries), a real
// friends list (GetFriendList — only works if the account's friends
// list is public), and achievement-completion-based progress (a
// genuine proxy, not a literal "% through the story", since no
// platform publishes that as a real data point). See
// lib/friendsData.js for how these combine.

import { useEffect, useState } from "react";
import { fetchRealFriends, fetchOwnProgress } from "../lib/friendsData";
import { fetchOwnedGames } from "../lib/steam";
import { fetchCurrentActivity, fetchPlatformPlaytime } from "../lib/crossPlatformActivity";
import UnderConstructionOverlay from "./UnderConstructionOverlay";
import { AccountGatePanel } from "./AccountGate";

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function FriendSection({ isLoggedIn, onSignIn, onCreateAccount, linkedSteamId, onGoToLinking, userId }) {
  const [ownProgress, setOwnProgress] = useState(null);
  const [ownStatus, setOwnStatus] = useState("idle"); // idle | loading | ready | error

  const [friends, setFriends] = useState([]);
  const [friendsStatus, setFriendsStatus] = useState("idle");

  // Combined cross-platform playtime — Steam's own exact historical
  // total (fetchOwnedGames), plus whatever the separate presence bot
  // has accumulated for Xbox/PlayStation since Discord was linked (see
  // /discord-bot and lib/crossPlatformActivity.js). Independent of
  // linkedSteamId/userId's OTHER effects below since it needs both
  // pieces of data together before it can compute a combined total.
  const [totalPlaytime, setTotalPlaytime] = useState(null); // { steamHours, xboxHours, playstationHours, totalHours }
  const [liveActivity, setLiveActivity] = useState(null); // { platform, game_name } from the bot, or null
  const [playtimeStatus, setPlaytimeStatus] = useState("idle");

  useEffect(() => {
    if (!userId) return;

    setPlaytimeStatus("loading");
    Promise.all([
      linkedSteamId ? fetchOwnedGames(linkedSteamId) : Promise.resolve([]),
      fetchPlatformPlaytime(userId),
      fetchCurrentActivity(userId),
    ])
      .then(([steamGames, platformRows, activity]) => {
        const steamMinutes = steamGames.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
        const xboxMinutes = platformRows
          .filter((r) => r.platform === "xbox")
          .reduce((sum, r) => sum + r.total_minutes, 0);
        const playstationMinutes = platformRows
          .filter((r) => r.platform === "playstation")
          .reduce((sum, r) => sum + r.total_minutes, 0);

        setTotalPlaytime({
          steamHours: Math.round(steamMinutes / 60),
          xboxHours: Math.round(xboxMinutes / 60),
          playstationHours: Math.round(playstationMinutes / 60),
          totalHours: Math.round((steamMinutes + xboxMinutes + playstationMinutes) / 60),
        });
        setLiveActivity(activity?.game_name ? activity : null);
        setPlaytimeStatus("ready");
      })
      .catch((err) => {
        console.error("Cross-platform playtime fetch failed:", err);
        setPlaytimeStatus("error");
      });
  }, [userId, linkedSteamId]);

  useEffect(() => {
    if (!linkedSteamId) return;

    setOwnStatus("loading");
    fetchOwnProgress(linkedSteamId)
      .then((result) => {
        setOwnProgress(result);
        setOwnStatus("ready");
      })
      .catch((err) => {
        console.error("Own progress fetch failed:", err);
        setOwnStatus("error");
      });

    setFriendsStatus("loading");
    fetchRealFriends(linkedSteamId)
      .then((result) => {
        setFriends(result);
        setFriendsStatus("ready");
      })
      .catch((err) => {
        console.error("Friends fetch failed:", err);
        setFriendsStatus("error");
      });
  }, [linkedSteamId]);

  return (
    <section id="friends" className="panel panel--lime panel--wide">
      {(!isLoggedIn || !linkedSteamId) && <UnderConstructionOverlay />}
      <div className="panel__head">
        <span className="panel__eyebrow">Dashboard 4</span>
        <h2 className="panel__title">Friend Details</h2>
        <p className="panel__subtitle">
          Live activity and friends via Steam, plus cross-platform playtime via Discord.
        </p>
      </div>

      {!isLoggedIn && (
        <AccountGatePanel
          message="Sign in to see your friends' activity and your own progress."
          onSignIn={onSignIn}
          onCreateAccount={onCreateAccount}
        />
      )}

      {isLoggedIn && !linkedSteamId && (
        <p className="panel__status">
          No Steam account linked yet —{" "}
          <button type="button" className="steam-sync-link" onClick={onGoToLinking}>
            link one on Account Linking
          </button>{" "}
          to see your friends and progress.
        </p>
      )}

      {isLoggedIn && linkedSteamId && (
        <>
          {playtimeStatus === "ready" && totalPlaytime && (
            <div className="total-playtime">
              <div className="total-playtime__head">
                <span className="feed-col__label">Total playtime, every platform</span>
                {liveActivity && (
                  <span className="own-progress-row__live">
                    ● Playing {liveActivity.game_name}
                    {liveActivity.platform && liveActivity.platform !== "unknown" ? ` on ${liveActivity.platform}` : ""}
                  </span>
                )}
              </div>
              <span className="total-playtime__value">{totalPlaytime.totalHours.toLocaleString()}h</span>
              <div className="total-playtime__breakdown">
                <span>{totalPlaytime.steamHours}h Steam</span>
                {totalPlaytime.xboxHours > 0 && <span>{totalPlaytime.xboxHours}h Xbox</span>}
                {totalPlaytime.playstationHours > 0 && <span>{totalPlaytime.playstationHours}h PlayStation</span>}
              </div>
              {totalPlaytime.xboxHours === 0 && totalPlaytime.playstationHours === 0 && (
                <p className="total-playtime__note">
                  Console hours only start counting from when Discord's linked and you're in the
                  tracking server — there's no way to pull in time already played before that.
                </p>
              )}
            </div>
          )}

          <div className="friend-section__progress">
            <span className="feed-col__label">Your progress</span>
            {ownStatus === "loading" && <p className="panel__status">Loading…</p>}
            {ownStatus === "error" && (
              <p className="panel__status panel__status--error">Couldn't load your progress right now.</p>
            )}
            {ownStatus === "ready" && !ownProgress && (
              <p className="panel__status">No owned games visible on this Steam profile.</p>
            )}
            {ownStatus === "ready" && ownProgress && (
              <div className="own-progress-row">
                {ownProgress.thumb ? (
                  <img src={ownProgress.thumb} alt="" className="own-progress-row__thumb" />
                ) : (
                  <div className="own-progress-row__thumb own-progress-row__thumb--placeholder" />
                )}
                <div className="own-progress-row__body">
                  <span className="own-progress-row__name">
                    {ownProgress.gameName}
                    {ownProgress.isCurrentlyPlaying && (
                      <span className="own-progress-row__live">● Playing now</span>
                    )}
                  </span>
                  {ownProgress.completionPct != null && (
                    <div className="friend-row__progress-bar">
                      <div
                        className="friend-row__progress-fill"
                        style={{ width: `${ownProgress.completionPct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="panel__stat-row">
                  {ownProgress.completionPct != null && (
                    <div className="panel__stat">
                      <span className="panel__stat-value">{ownProgress.completionPct}%</span>
                      <span className="panel__stat-label">Achievements</span>
                    </div>
                  )}
                  <div className="panel__stat">
                    <span className="panel__stat-value">{ownProgress.playtimeHours}h</span>
                    <span className="panel__stat-label">Playtime</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="feed-col__label">Friends</span>
          {friendsStatus === "loading" && <p className="panel__status">Loading your friends…</p>}
          {friendsStatus === "error" && (
            <p className="panel__status panel__status--error">Couldn't load your friends right now.</p>
          )}
          {friendsStatus === "ready" && friends.length === 0 && (
            <p className="panel__status">No public friends list found on this Steam profile.</p>
          )}
          {friendsStatus === "ready" && friends.length > 0 && (
            <ul className="friend-list">
              {friends.map((f) => (
                <li key={f.steamid} className="friend-row">
                  {f.avatar ? (
                    <img src={f.avatar} alt="" className="friend-row__avatar friend-row__avatar--img" />
                  ) : (
                    <div className="friend-row__avatar" aria-hidden="true">{initials(f.name)}</div>
                  )}

                  <div className="friend-row__identity">
                    <span className="friend-row__name">{f.name}</span>
                    <span className="friend-row__playing">
                      {f.playing ? `Playing ${f.playing}` : f.online ? "Online" : "Offline"}
                    </span>
                  </div>

                  {f.progress != null ? (
                    <div className="friend-row__stat">
                      <div className="friend-row__progress-bar">
                        <div className="friend-row__progress-fill" style={{ width: `${f.progress}%` }} />
                      </div>
                      <span className="friend-row__stat-label">{f.progress}% achievements</span>
                    </div>
                  ) : (
                    <div className="friend-row__stat" />
                  )}

                  <div className={`friend-row__online-dot ${f.online ? "friend-row__online-dot--on" : ""}`} title={f.online ? "Online" : "Offline"} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
