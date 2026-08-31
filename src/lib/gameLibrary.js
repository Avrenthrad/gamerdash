// Gaming Collection's real owned-games library (game_library_items) —
// one flat list of every game a person owns on Xbox/PlayStation,
// tagged with its platform. Deliberately separate from Backlog
// (lib/backlog.js): that's a 4-state status-tracked list for games
// someone's actively deciding to play next, and bulk-importing a
// person's full Xbox/PSN library into it would've silently defaulted
// every single imported game to status "backlog" (not yet played) —
// wrong for games they've already finished. This table has no status
// at all, just "you own this, on this platform."
//
// Steam isn't stored here — LibraryPage.jsx (Gaming Collection) still
// live-fetches Steam's owned-games list directly from Steam's Web API
// on every load, same as before this table existed; Steam's data is
// already real-time and doesn't need a separate persisted copy.

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

// De-dup on (user_id, platform, title) is enforced by a real unique
// index at the DB level — ignoreDuplicates makes a repeat import (or
// a game already added) a silent no-op rather than an error, so
// callers can just insert whatever a bulk import returns without
// checking for existing rows first. Chaining .select() is what makes
// the return value meaningful here: Postgres' ON CONFLICT DO NOTHING
// (what ignoreDuplicates maps to) returns no row at all for a skipped
// conflict, so an empty array — not just the absence of an error — is
// how a caller tells "already had this one" apart from "just added
// it" (see lib/libraryImport.js's import-progress count).
export async function addToGameLibrary(userId, title, platform, steamAppid = null) {
  const { data, error } = await supabase
    .from("game_library_items")
    .upsert(
      { user_id: userId, title, platform, steam_appid: steamAppid ? String(steamAppid) : null },
      { onConflict: "user_id,platform,title", ignoreDuplicates: true }
    )
    .select();
  if (error) throw error;
  return (data || []).length > 0; // true only if this was a genuinely new row
}

export async function removeFromGameLibrary(itemId) {
  const { error } = await supabase.from("game_library_items").delete().eq("id", itemId);
  if (error) throw error;
}
