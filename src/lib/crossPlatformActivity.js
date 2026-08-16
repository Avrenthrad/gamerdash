// Reads the data the separate presence bot writes (see /discord-bot).
// This is the ONE place in the main app that queries current_activity
// and platform_playtime — everything here is a plain read using the
// normal anon-key client, protected by the "any signed-in user can
// read" RLS policies set up in schema.sql (the bot is what writes to
// these tables, using its own separate service_role key, never this one).

import { supabase } from "./supabaseClient";

export async function fetchCurrentActivity(userId) {
  const { data, error } = await supabase
    .from("current_activity")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data; // { platform, game_name, updated_at } or null if never set
}

export async function fetchPlatformPlaytime(userId) {
  const { data, error } = await supabase
    .from("platform_playtime")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data || []; // [{ platform, game_name, total_minutes }, ...]
}
