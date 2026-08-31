// Gaming Collection's real owned-games library (game_library_items) —
// one flat list of every game a person owns on Xbox/PlayStation,
// tagged with its platform. Deliberately separate from Backlog
// (lib/backlog.js): that's a 4-state status-tracked list for games
// someone's actively deciding to play next, and bulk-importing a
// person's full Xbox/PSN library into it would've silently defaulted
// every single imported game to status "backlog" (not yet played) —
// wrong for games they've already finished. This table has no status
// at all, just "you own this, on this platform."

import { supabase } from "./supabaseClient";

export async function fetchGameLibrary(userId) {
  const { data, error } = await supabase
    .from("game_library_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addToGameLibrary(userId, title, platform, steamAppid = null, parentTitle = null) {
  // ignoreDuplicates is required, not optional: without it Supabase
  // issues an ON CONFLICT DO UPDATE, which needs an UPDATE RLS policy
  // to check visibility of the pre-existing row — and this table
  // deliberately has none (see the file header: there's no status
  // field, nothing here ever needs updating). Without the flag this
  // fails outright with "violates row-level security policy (USING
  // expression)" on every already-owned title, confirmed live.
  const { data, error } = await supabase
    .from("game_library_items")
    .upsert(
      {
        user_id: userId,
        title,
        platform,
        steam_appid: steamAppid ? String(steamAppid) : null,
        parent_title: parentTitle || null,
      },
      { onConflict: "user_id,platform,title", ignoreDuplicates: true }
    )
    .select();
  if (error) throw error;
  return (data || []).length > 0;
}

export async function removeFromGameLibrary(itemId) {
  const { error } = await supabase.from("game_library_items").delete().eq("id", itemId);
  if (error) throw error;
}

function normalizeTitleKey(title) {
  return title.trim().toLowerCase();
}

// Best-effort parent match for Xbox/PSN titles like "Destiny 2: Shadowkeep".
export function inferParentTitleFromName(title, baseTitleKeys) {
  const colonIdx = title.indexOf(":");
  if (colonIdx > 0) {
    const base = title.slice(0, colonIdx).trim();
    if (baseTitleKeys.has(normalizeTitleKey(base))) return base;
  }

  const dashMatch = title.match(/^(.+?)\s+-\s+/);
  if (dashMatch) {
    const base = dashMatch[1].trim();
    if (baseTitleKeys.has(normalizeTitleKey(base))) return base;
  }

  return null;
}

// One card per base game title — multiple platforms on the same row, with
// purchased DLC nested under the parent instead of as separate cards.
export function mergeLibraryByTitle({ steamGames = [], libraryItems = [], platformPlaytime = [] }) {
  const rawEntries = [];

  for (const game of steamGames) {
    rawEntries.push({
      title: game.name,
      platform: "steam",
      steamAppid: game.appid ? String(game.appid) : null,
      playtimeMinutes: game.playtime_forever || 0,
      imgIconUrl: game.img_icon_url || null,
      parentTitle: null,
    });
  }

  for (const item of libraryItems) {
    rawEntries.push({
      title: item.title,
      platform: item.platform,
      steamAppid: item.steam_appid ? String(item.steam_appid) : null,
      playtimeMinutes: 0,
      imgIconUrl: null,
      parentTitle: item.parent_title || null,
    });
  }

  // DLC nesting relies ONLY on an explicit, already-verified
  // item.parent_title (Steam-imported rows get this from Steam's own
  // real appdetails type/fullgame fields — see libraryImport.js's
  // importSteamLibrary). This used to also re-run the
  // inferParentTitleFromName string heuristic here for every entry
  // lacking one — confirmed live to wrongly nest entire separate games
  // (Final Fantasy IV: The After Years, Call of Duty: Black Ops, and
  // others) under a same-prefix title purely because colon-subtitled
  // sequels read identically to real DLC names to a string match. That
  // pass has been removed entirely: an entry with no verified
  // parent_title now always renders as its own standalone game rather
  // than being guessed into someone else's DLC list.

  const map = new Map();
  const dlcByParent = new Map();

  function ensureParent(title) {
    const key = normalizeTitleKey(title);
    if (!map.has(key)) {
      map.set(key, {
        title: title.trim(),
        platforms: new Set(),
        playtimeMinutes: {},
        steamAppid: null,
        imgIconUrl: null,
        dlc: [],
      });
    }
    return map.get(key);
  }

  for (const entry of rawEntries) {
    if (entry.parentTitle) {
      const parentKey = normalizeTitleKey(entry.parentTitle);
      if (!dlcByParent.has(parentKey)) dlcByParent.set(parentKey, []);
      dlcByParent.get(parentKey).push({
        title: entry.title,
        platform: entry.platform,
      });
      continue;
    }

    const parent = ensureParent(entry.title);
    parent.platforms.add(entry.platform);
    if (entry.steamAppid) parent.steamAppid = entry.steamAppid;
    if (entry.imgIconUrl) parent.imgIconUrl = entry.imgIconUrl;
    if (entry.playtimeMinutes != null) {
      parent.playtimeMinutes[entry.platform] = Math.max(
        parent.playtimeMinutes[entry.platform] || 0,
        entry.playtimeMinutes
      );
    }
  }

  for (const row of platformPlaytime) {
    if (row.platform !== "xbox" && row.platform !== "playstation") continue;
    const parent = map.get(normalizeTitleKey(row.game_name));
    if (!parent) continue;
    parent.platforms.add(row.platform);
    parent.playtimeMinutes[row.platform] = Math.max(
      parent.playtimeMinutes[row.platform] || 0,
      row.total_minutes || 0
    );
  }

  for (const [parentKey, dlcList] of dlcByParent) {
    const parent = map.get(parentKey);
    if (!parent) continue;
    const seen = new Set(parent.dlc.map((item) => `${item.platform}:${item.title}`));
    for (const item of dlcList) {
      const key = `${item.platform}:${item.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parent.dlc.push(item);
    }
    parent.dlc.sort((a, b) => a.title.localeCompare(b.title));
  }

  return [...map.values()].map((entry) => ({
    ...entry,
    platforms: [...entry.platforms].sort(),
    totalPlaytimeMinutes: Object.values(entry.playtimeMinutes).reduce((sum, mins) => sum + mins, 0),
  }));
}
