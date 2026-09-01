// Gaming Collection's Full Library row tags — Completed, Run It Back,
// 100%, Dropped. Deliberately separate from backlog_items' 4-state
// status model (see lib/backlog.js): these are independent, non-
// exclusive flags a person can combine freely (a game can be
// Completed, marked 100%, AND flagged Run It Back all at once), which
// a single status column can't represent. "Backlog" is not a tag
// here — the Backlog+ action adds a real row to backlog_items instead
// (see lib/backlog.js's addToBacklog), it doesn't set a flag here.

import { supabase } from "./supabaseClient";

export const LIBRARY_TAGS = ["completed", "run_it_back", "hundred_percent", "dropped"];

// { title -> Set(tag) } for every tag this user has set, across their
// whole library — fetched once per page load, not per row.
export async function fetchGameLibraryTags(userId) {
  const { data, error } = await supabase
    .from("game_library_tags")
    .select("title, tag")
    .eq("user_id", userId);
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.title)) map.set(row.title, new Set());
    map.get(row.title).add(row.tag);
  }
  return map;
}

// Toggles one tag for one title — adds it if not already set, removes
// it if it is. Returns the new boolean state (true = now set).
export async function toggleGameLibraryTag(userId, title, tag, currentlySet) {
  if (currentlySet) {
    const { error } = await supabase
      .from("game_library_tags")
      .delete()
      .eq("user_id", userId)
      .eq("title", title)
      .eq("tag", tag);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("game_library_tags")
    .upsert({ user_id: userId, title, tag }, { onConflict: "user_id,title,tag", ignoreDuplicates: true });
  if (error) throw error;
  return true;
}
