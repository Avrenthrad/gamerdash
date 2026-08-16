// Safe, minimal public-profile lookups — profiles' own SELECT policy
// is strictly self-only (auth.uid() = id), so names/avatars for
// anyone else come through this narrow RPC instead of the raw table.
// Shared by lib/guilds.js (roster/invite display) and lib/friends.js
// (friend list/request display) — kept in its own module so neither
// has to import the other.

import { supabase } from "./supabaseClient";

export async function getPublicProfiles(ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase.rpc("get_public_profiles", { p_ids: ids });
  if (error) throw error;
  return data || [];
}
