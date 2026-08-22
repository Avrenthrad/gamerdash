// Achievement/trophy tracker for the Gaming College.
//
// Steam tab is a live, read-only view of real Steam data (schema +
// unlock state + global rarity, all already fetched elsewhere in this
// app for the Backlog page and Game Mastery Score — this is the first
// place that renders the actual per-achievement list). Nothing to
// "tick off" here since Steam already tracks it automatically.
//
// Xbox/PlayStation tabs are a genuine manual tracker — neither
// platform has a public API for a person's own achievement/trophy
// list, so there's no real list to seed a checklist from (same gap
// GameMasterySection's self-reported Gamerscore/trophy counts already
// work around). The person types in what they're tracking and ticks
// it off as they earn it.

import { useEffect, useState } from "react";
import {
  fetchOwnedGames,
  fetchAchievementSchema,
  fetchAchievements,
  fetchGlobalAchievementPercentages,
  steamHeaderArt,
} from "../lib/steam";
import {
  fetchPlatformAchievements,
  addPlatformAchievement,
  toggleAchievementUnlocked,
  deletePlatformAchievement,
} from "../lib/platformAchievements";
import { recordGameCompletionIfNew } from "../lib/achievements";

const GAMES_PER_PAGE = 5;

function relativeTime(unixSeconds) {
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86_400);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

async function fetchMergedAchievements(steamId, appid) {
  const [schema, unlocked, rarity] = await Promise.all([
    fetchAchievementSchema(appid),
    fetchAchievements(steamId, appid),
    fetchGlobalAchievementPercentages(appid).catch(() => []),
  ]);
  const unlockedByName = new Map(unlocked.map((a) => [a.apiname, a]));
  // Steam returns percent as a string (e.g. "75.0"), not a number —
  // same real quirk lib/achievements.js and lib/gameMasteryData.js
  // already cast around; this file just hadn't been fixed yet, since
  // it never actually rendered in production before the routing bug
  // above was fixed (row.rarity.toFixed(1) below throws on a string).
  const rarityByName = new Map(rarity.map((a) => [a.name, Number(a.percent)]));
  const merged = schema.map((def) => ({
    apiname: def.name,
    displayName: def.displayName || def.name,
    description: def.description || "",
    icon: def.icon,
    icongray: def.icongray,
    unlocked: unlockedByName.get(def.name)?.achieved === 1,
    unlockedAt: unlockedByName.get(def.name)?.unlocktime || null,
    rarity: rarityByName.get(def.name),
  }));
  merged.sort((a, b) => (b.unlocked === a.unlocked ? 0 : b.unlocked ? 1 : -1));
  return merged;
}

const TABS = [
  { id: "steam", label: "Steam" },
  { id: "xbox", label: "Xbox" },
  { id: "playstation", label: "PlayStation" },
];

export default function AchievementsPage({ onBack, userId, linkedSteamId }) {
  const [tab, setTab] = useState("steam");

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Gaming</button>
        <h1 className="price-page__title">Achievements</h1>
        <p className="price-page__subtitle">
          Steam syncs automatically. Xbox and PlayStation are tracked manually.
        </p>
      </div>

      <div className="backlog-status-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`quickdash-reset-btn ${tab === t.id ? "quickdash-reset-btn--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "steam" && <SteamAchievements linkedSteamId={linkedSteamId} userId={userId} />}
      {tab === "xbox" && <ManualAchievements userId={userId} platform="xbox" platformLabel="Xbox" />}
      {tab === "playstation" && <ManualAchievements userId={userId} platform="playstation" platformLabel="PlayStation" />}
    </div>
  );
}

function SteamAchievements({ linkedSteamId, userId }) {
  const [games, setGames] = useState([]);
  const [gamesStatus, setGamesStatus] = useState("idle"); // idle | loading | ready | error
  const [page, setPage] = useState(0);
  const [pageRows, setPageRows] = useState({}); // appid -> merged achievement rows
  const [pageStatus, setPageStatus] = useState("idle");
  const [filter, setFilter] = useState("all"); // all | unlocked | locked
  const [liveAchievement, setLiveAchievement] = useState(undefined); // undefined = not checked yet, null = none found
  const [newCompletion, setNewCompletion] = useState(null); // { gameName, totalAchievements } — a freshly detected 100%

  // Real recency proxy — same one ContinuePlayingCard uses, since Steam's
  // true per-game last-played timestamp (rtime_last_played) doesn't
  // populate for a shared server API key looking up someone else's
  // account (confirmed live). playtime_2weeks is real and does.
  useEffect(() => {
    if (!linkedSteamId) return;
    setGamesStatus("loading");
    fetchOwnedGames(linkedSteamId)
      .then((list) => {
        const sorted = [...list].sort((a, b) => {
          const recent = (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0);
          if (recent !== 0) return recent;
          return (b.playtime_forever || 0) - (a.playtime_forever || 0);
        });
        setGames(sorted);
        setGamesStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load Steam library for achievements:", err);
        setGamesStatus("error");
      });
  }, [linkedSteamId]);

  const totalPages = Math.ceil(games.length / GAMES_PER_PAGE) || 1;
  const pageGames = games.slice(page * GAMES_PER_PAGE, page * GAMES_PER_PAGE + GAMES_PER_PAGE);

  useEffect(() => {
    if (pageGames.length === 0) return;
    let cancelled = false;
    setPageStatus("loading");

    Promise.all(
      pageGames.map((g) =>
        fetchMergedAchievements(linkedSteamId, g.appid)
          .then((rows) => ({ appid: g.appid, rows }))
          .catch(() => ({ appid: g.appid, rows: null })) // null = failed/no achievements
      )
    ).then((results) => {
      if (cancelled) return;
      const byAppid = {};
      results.forEach((r) => { byAppid[r.appid] = r.rows; });
      setPageRows(byAppid);
      setPageStatus("ready");

      // "Live Achievement" — the single real most-recent unlock across
      // your 5 most-recently-played games, computed once from page 0.
      if (page === 0 && liveAchievement === undefined) {
        let latest = null;
        results.forEach(({ appid, rows }) => {
          (rows || []).forEach((row) => {
            if (row.unlocked && row.unlockedAt && (!latest || row.unlockedAt > latest.unlockedAt)) {
              const game = pageGames.find((g) => g.appid === appid);
              latest = { ...row, appid, gameName: game?.name };
            }
          });
        });
        setLiveAchievement(latest);
      }

      // 100%-completion detection — a real, verifiable claim since
      // Steam's schema lists every achievement that exists, not just
      // ones the person chose to track. recordGameCompletionIfNew's own
      // unique constraint (not this check) is what stops it firing more
      // than once per game; this just avoids a wasted round-trip for
      // games we already know aren't complete.
      results.forEach(({ appid, rows }) => {
        if (!rows || rows.length === 0) return;
        const unlockedCount = rows.filter((r) => r.unlocked).length;
        if (unlockedCount !== rows.length) return;
        const game = pageGames.find((g) => g.appid === appid);
        recordGameCompletionIfNew(userId, { appid, gameName: game?.name || "", totalAchievements: rows.length })
          .then((isNew) => {
            if (!cancelled && isNew) {
              setNewCompletion({ gameName: game?.name || "", totalAchievements: rows.length });
            }
          });
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, games, linkedSteamId]);

  if (!linkedSteamId) {
    return <p className="panel__status">Link Steam to see your real achievement lists here.</p>;
  }

  return (
    <>
      {gamesStatus === "loading" && <p className="panel__status">Loading your Steam library…</p>}
      {gamesStatus === "error" && <p className="panel__status panel__status--error">Couldn't load your Steam library right now.</p>}
      {gamesStatus === "ready" && games.length === 0 && (
        <p className="panel__status">No owned games visible on this Steam profile.</p>
      )}

      {newCompletion && (
        <div className="completion-banner">
          <span className="completion-banner__icon" aria-hidden="true">🏆</span>
          <div className="completion-banner__body">
            <span className="completion-banner__title">100% Complete</span>
            <span className="completion-banner__desc">
              Every one of {newCompletion.totalAchievements} achievements unlocked in {newCompletion.gameName}. Your Guilds just heard about it.
            </span>
          </div>
          <button
            type="button"
            className="game-popup__close"
            onClick={() => setNewCompletion(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {liveAchievement && (
        <div className="live-achievement">
          <span className="panel__eyebrow">● Live Achievement</span>
          <div className="live-achievement__body">
            <img src={liveAchievement.icon} alt="" className="live-achievement__icon" />
            <div>
              <span className="achievement-row__name">{liveAchievement.displayName}</span>
              <span className="achievement-row__desc">
                {liveAchievement.gameName} · unlocked {relativeTime(liveAchievement.unlockedAt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {gamesStatus === "ready" && games.length > 0 && (
        <>
          <div className="backlog-add">
            <label className="currency-picker">
              <span>Show</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All achievements</option>
                <option value="unlocked">Unlocked only</option>
                <option value="locked">Locked only</option>
              </select>
            </label>
            <div className="achievement-pager">
              <button
                type="button"
                className="quickdash-reset-btn"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Previous 5
              </button>
              <span className="panel__status" style={{ margin: 0 }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="quickdash-reset-btn"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next 5 →
              </button>
            </div>
          </div>

          {pageGames.map((g) => {
            const rows = pageRows[g.appid];
            const filteredRows = (rows || []).filter((r) => {
              if (filter === "unlocked") return r.unlocked;
              if (filter === "locked") return !r.unlocked;
              return true;
            });
            const unlockedCount = (rows || []).filter((r) => r.unlocked).length;

            return (
              <div key={g.appid} className="achievement-group">
                <h3 className="achievement-group__title">
                  <img src={steamHeaderArt(g.appid)} alt="" className="achievement-group__thumb" />
                  {g.name}
                  {rows && rows.length > 0 && (
                    <span className="score-badge">{unlockedCount}/{rows.length}</span>
                  )}
                </h3>

                {pageStatus === "loading" && !rows && <p className="panel__status">Loading…</p>}
                {rows === null && <p className="panel__status panel__status--error">Couldn't load achievements for this game.</p>}
                {rows && rows.length === 0 && <p className="panel__status">No Steam achievements for this game.</p>}

                {rows && rows.length > 0 && (
                  <ul className="achievement-list">
                    {filteredRows.map((row) => (
                      <li key={row.apiname} className={`achievement-row ${row.unlocked ? "achievement-row--unlocked" : ""}`}>
                        <img
                          src={row.unlocked ? row.icon : row.icongray || row.icon}
                          alt=""
                          className="achievement-row__icon"
                        />
                        <div className="achievement-row__body">
                          <span className="achievement-row__name">{row.displayName}</span>
                          {row.description && <span className="achievement-row__desc">{row.description}</span>}
                          {row.unlocked && row.unlockedAt && (
                            <span className="achievement-row__desc">Unlocked {relativeTime(row.unlockedAt)}</span>
                          )}
                        </div>
                        {row.rarity != null && (
                          <span className="score-badge" title="Percentage of all Steam players who've unlocked this">
                            {row.rarity.toFixed(1)}% of players
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function ManualAchievements({ userId, platform, platformLabel }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [gameName, setGameName] = useState("");
  const [achievementName, setAchievementName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setStatus("loading");
    try {
      const data = await fetchPlatformAchievements(userId, platform);
      setRows(data);
      setStatus("ready");
    } catch (err) {
      console.error(`Failed to load ${platform} achievements:`, err);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, platform]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!gameName.trim() || !achievementName.trim()) return;
    try {
      await addPlatformAchievement(userId, platform, {
        gameName: gameName.trim(),
        achievementName: achievementName.trim(),
        description: description.trim(),
      });
      setAchievementName("");
      setDescription("");
      load();
    } catch (err) {
      console.error("Failed to add achievement:", err);
    }
  }

  async function handleToggle(row) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, unlocked: !r.unlocked } : r)));
    try {
      await toggleAchievementUnlocked(row.id, !row.unlocked);
    } catch (err) {
      console.error("Failed to update achievement:", err);
      load();
    }
  }

  async function handleDelete(row) {
    try {
      await deletePlatformAchievement(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      console.error("Failed to delete achievement:", err);
    }
  }

  const gameNames = [...new Set(rows.map((r) => r.game_name))];
  const rowsByGame = gameNames.map((name) => ({
    name,
    achievements: rows.filter((r) => r.game_name === name),
  }));

  return (
    <>
      <form className="backlog-add" onSubmit={handleAdd}>
        <div className="price-search">
          <input
            className="price-search__input"
            type="text"
            placeholder={`${platformLabel} game name…`}
            list="platform-achievement-games"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />
          <input
            className="price-search__input"
            type="text"
            placeholder="Achievement or trophy name…"
            value={achievementName}
            onChange={(e) => setAchievementName(e.target.value)}
          />
        </div>
        <input
          className="price-search__input"
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <datalist id="platform-achievement-games">
          {gameNames.map((name) => <option key={name} value={name} />)}
        </datalist>
        <button type="submit" className="price-search__button">Add</button>
      </form>

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your {platformLabel} achievements.</p>}
      {status === "ready" && rows.length === 0 && (
        <p className="panel__status">
          Nothing tracked yet — add {platformLabel} achievements/trophies above as you earn them.
        </p>
      )}

      {status === "ready" && rowsByGame.map((group) => {
        const unlockedCount = group.achievements.filter((a) => a.unlocked).length;
        return (
          <div key={group.name} className="achievement-group">
            <h3 className="achievement-group__title">
              {group.name}
              <span className="score-badge">{unlockedCount}/{group.achievements.length}</span>
            </h3>
            <ul className="achievement-list">
              {group.achievements.map((row) => (
                <li key={row.id} className={`achievement-row ${row.unlocked ? "achievement-row--unlocked" : ""}`}>
                  <label className="achievement-row__checkbox">
                    <input type="checkbox" checked={row.unlocked} onChange={() => handleToggle(row)} />
                  </label>
                  <div className="achievement-row__body">
                    <span className="achievement-row__name">{row.achievement_name}</span>
                    {row.description && <span className="achievement-row__desc">{row.description}</span>}
                  </div>
                  <button type="button" className="game-popup__close" onClick={() => handleDelete(row)} aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
