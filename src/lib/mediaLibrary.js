// Library College's real imported-media library (media_library_items)
// — same shape/reason as lib/gameLibrary.js's Gaming equivalent: a
// flat "you have this, from this source" list with no status/
// completion tracking forced onto it. entertainment_entries already
// has a status field (completed/watching/want_to_watch) for what a
// person manually tracks; bulk-importing a full Crunchyroll/Kindle/
// Audible history into that table would silently default every
// imported title to one status, wrong for a real mix of finished/
// in-progress/never-started history.

import { supabase } from "./supabaseClient";

export async function fetchMediaLibrary(userId) {
  const { data, error } = await supabase
    .from("media_library_items")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// De-dup on (user_id, source, title) is enforced by a real unique
// index at the DB level — ignoreDuplicates makes a repeat import a
// silent no-op rather than an error. Returns true only if this was a
// genuinely new row (see gameLibrary.js's addToGameLibrary for why
// .select() is what actually makes that distinction possible).
export async function addToMediaLibrary(userId, title, source) {
  const { data, error } = await supabase
    .from("media_library_items")
    .upsert(
      { user_id: userId, title, source },
      { onConflict: "user_id,source,title", ignoreDuplicates: true }
    )
    .select();
  if (error) throw error;
  return (data || []).length > 0;
}

export async function removeFromMediaLibrary(itemId) {
  const { error } = await supabase.from("media_library_items").delete().eq("id", itemId);
  if (error) throw error;
}
