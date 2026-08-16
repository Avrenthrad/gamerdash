// Tabletop College — real RPG and wargame tracking. Phase 1: pure
// CRUD, real manual session hours, real win/loss history. Deliberately
// doesn't include dice engine, turn tracker, or infrastructure for
// two unbuilt future products (a Discord integration, a digital VTT
// app) — those are real future ideas but not scoped yet, and building
// schema for them now risks reworking live tables later.

import { supabase } from "./supabaseClient";

// ---------- Campaigns ----------

export async function fetchCampaigns(userId) {
  const { data, error } = await supabase
    .from("tabletop_campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCampaign(userId, campaign) {
  const { data, error } = await supabase
    .from("tabletop_campaigns")
    .insert({
      user_id: userId,
      name: campaign.name,
      system_key: campaign.systemKey,
      role: campaign.role,
      external_vtt_url: campaign.externalVttUrl || null,
      dndbeyond_campaign_url: campaign.dndbeyondUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(campaignId, patch) {
  const { error } = await supabase
    .from("tabletop_campaigns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function deleteCampaign(campaignId) {
  const { error } = await supabase.from("tabletop_campaigns").delete().eq("id", campaignId);
  if (error) throw error;
}

// ---------- Characters ----------

export async function fetchCharacters(userId) {
  const { data, error } = await supabase
    .from("tabletop_characters")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCharacter(userId, character) {
  const { error } = await supabase.from("tabletop_characters").insert({
    user_id: userId,
    campaign_id: character.campaignId || null,
    name: character.name,
    system_key: character.systemKey,
    class_or_playbook: character.classOrPlaybook || null,
    level_or_tier: character.levelOrTier || null,
    sheet_url: character.sheetUrl || null,
  });
  if (error) throw error;
}

export async function deleteCharacter(characterId) {
  const { error } = await supabase.from("tabletop_characters").delete().eq("id", characterId);
  if (error) throw error;
}

// ---------- Sessions ----------

export async function fetchSessions(campaignId) {
  const { data, error } = await supabase
    .from("tabletop_sessions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("played_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function logSession(userId, campaignId, session) {
  const { error } = await supabase.from("tabletop_sessions").insert({
    user_id: userId,
    campaign_id: campaignId,
    played_at: session.playedAt || new Date().toISOString().slice(0, 10),
    duration_minutes: session.durationMinutes || null,
    recap: session.recap || null,
  });
  if (error) throw error;

  // Real total, not a guess — sum of every logged session for this
  // campaign, recomputed rather than incrementally tracked, so it
  // can never drift out of sync if a session is edited or deleted.
  const { data: sessions } = await supabase
    .from("tabletop_sessions")
    .select("duration_minutes")
    .eq("campaign_id", campaignId);
  const totalMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  await supabase.from("tabletop_campaigns").update({ total_session_minutes: totalMinutes }).eq("id", campaignId);
}

// ---------- Wargame armies ----------

export async function fetchArmies(userId) {
  const { data, error } = await supabase
    .from("wargame_armies")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createArmy(userId, army) {
  const { data, error } = await supabase
    .from("wargame_armies")
    .insert({
      user_id: userId,
      system_key: army.systemKey,
      name: army.name,
      faction: army.faction || null,
      points_limit: army.pointsLimit || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArmy(armyId) {
  const { error } = await supabase.from("wargame_armies").delete().eq("id", armyId);
  if (error) throw error;
}

// ---------- Wargame units ----------

export async function fetchUnits(armyId) {
  const { data, error } = await supabase
    .from("wargame_units")
    .select("*")
    .eq("army_id", armyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addUnit(userId, armyId, unit) {
  const { error } = await supabase.from("wargame_units").insert({
    user_id: userId,
    army_id: armyId,
    name: unit.name,
    datasheet_name: unit.datasheetName || null,
    model_count: unit.modelCount || 1,
    points_cost: unit.pointsCost || null,
    painted_status: unit.paintedStatus || "unassembled",
  });
  if (error) throw error;
}

export async function updateUnitStatus(unitId, paintedStatus) {
  const { error } = await supabase
    .from("wargame_units")
    .update({ painted_status: paintedStatus, updated_at: new Date().toISOString() })
    .eq("id", unitId);
  if (error) throw error;
}

export async function removeUnit(unitId) {
  const { error } = await supabase.from("wargame_units").delete().eq("id", unitId);
  if (error) throw error;
}

// ---------- Game results ----------

export async function fetchGames(userId) {
  const { data, error } = await supabase
    .from("wargame_games")
    .select("*")
    .eq("user_id", userId)
    .order("played_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function logGame(userId, game) {
  const { error } = await supabase.from("wargame_games").insert({
    user_id: userId,
    system_key: game.systemKey,
    army_id: game.armyId || null,
    played_at: game.playedAt || new Date().toISOString().slice(0, 10),
    opponent_name: game.opponentName || null,
    opponent_faction: game.opponentFaction || null,
    result: game.result,
    score_us: game.scoreUs || null,
    score_them: game.scoreThem || null,
    notes: game.notes || null,
  });
  if (error) throw error;
}

export async function deleteGame(gameId) {
  const { error } = await supabase.from("wargame_games").delete().eq("id", gameId);
  if (error) throw error;
}
