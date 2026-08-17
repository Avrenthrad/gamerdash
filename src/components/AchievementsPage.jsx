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
} from "../lib/steam";
import {
  fetchPlatformAchievements,
  addPlatformAchievement,
  toggleAchievementUnlocked,
  deletePlatformAchievement,
} from "../lib/platformAchievements";

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
          Steam's list is real and automatic — unlocked achievements, descriptions, and global
          rarity straight from Steam's own API. Xbox and PlayStation have no public API for a
          person's own achievements at all, so those two are a self-reported checklist you build
          yourself as you play — clearly labeled, not pulled from a live source.
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

      {tab === "steam" && <SteamAchievements linkedSteamId={linkedSteamId} />}
      {tab === "xbox" && <ManualAchievements userId={userId} platform="xbox" platformLabel="Xbox" />}
      {tab === "playstation" && <ManualAchievements userId={userId} platform="playstation" platformLabel="PlayStation" />}
    </div>
  );
}

function SteamAchievements({ linkedSteamId }) {
  const [games, setGames] = useState([]);
  const [gamesStatus, setGamesStatus] = useState("idle"); // idle | loading | ready | error
  const [selectedAppId, setSelectedAppId] = useState("");
  const [rows, setRows] = useState([]);
  const [rowsStatus, setRowsStatus] = useState("idle");
  const [filter, setFilter] = useState("all"); // all | unlocked | locked

  useEffect(() => {
    if (!linkedSteamId) return;
    setGamesStatus("loading");
    fetchOwnedGames(linkedSteamId)
      .then((list) => {
        setGames([...list].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0)));
        setGamesStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load Steam library for achievements:", err);
        setGamesStatus("error");
      });
  }, [linkedSteamId]);

  useEffect(() => {
    if (!selectedAppId) {
      setRows([]);
      return;
    }
    setRowsStatus("loading");
    Promise.all([
      fetchAchievementSchema(selectedAppId),
      fetchAchievements(linkedSteamId, selectedAppId),
      fetchGlobalAchievementPercentages(selectedAppId).catch(() => []),
    ])
      .then(([schema, unlocked, rarity]) => {
        const unlockedByName = new Map(unlocked.map((a) => [a.apiname, a]));
        const rarityByName = new Map(rarity.map((a) => [a.name, a.percent]));
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
        setRows(merged);
        setRowsStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load Steam achievements:", err);
        setRowsStatus("error");
      });
  }, [selectedAppId, linkedSteamId]);

  if (!linkedSteamId) {
    return <p className="panel__status">Link Steam to see your real achievement lists here.</p>;
  }

  const selectedGame = games.find((g) => String(g.appid) === String(selectedAppId));
  const unlockedCount = rows.filter((r) => r.unlocked).length;
  const filteredRows = rows.filter((r) => {
    if (filter === "unlocked") return r.unlocked;
    if (filter === "locked") return !r.unlocked;
    return true;
  });

  return (
    <>
      {gamesStatus === "loading" && <p className="panel__status">Loading your Steam library…</p>}
      {gamesStatus === "error" && <p className="panel__status panel__status--error">Couldn't load your Steam library right now.</p>}

      {gamesStatus === "ready" && (
        <div className="backlog-add">
          <label className="currency-picker">
            <span>Game</span>
            <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)}>
              <option value="">Pick a game…</option>
              {games.map((g) => (
                <option key={g.appid} value={g.appid}>{g.name}</option>
              ))}
            </select>
          </label>

          {rows.length > 0 && (
            <label className="currency-picker">
              <span>Show</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All ({rows.length})</option>
                <option value="unlocked">Unlocked ({unlockedCount})</option>
                <option value="locked">Locked ({rows.length - unlockedCount})</option>
              </select>
            </label>
          )}
        </div>
      )}

      {rowsStatus === "loading" && <p className="panel__status">Loading achievements for {selectedGame?.name}…</p>}
      {rowsStatus === "error" && <p className="panel__status panel__status--error">Couldn't load achievements for this game.</p>}
      {rowsStatus === "ready" && rows.length === 0 && (
        <p className="panel__status">{selectedGame?.name} doesn't have Steam achievements.</p>
      )}

      {rowsStatus === "ready" && filteredRows.length > 0 && (
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
