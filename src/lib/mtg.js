// Magic: The Gathering — collection tracking and deck building.
// Real card data throughout via Scryfall (see lib/scryfall.js).

import { supabase } from "./supabaseClient";
import { getCardById } from "./scryfall";
import { logActivityForUser } from "./guilds";

// ---------- Collection ----------

export async function fetchCollection(userId) {
  const { data, error } = await supabase
    .from("mtg_collection")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addToCollection(userId, card, { quantity = 1, foil = false, condition = "Near Mint" } = {}) {
  const { error } = await supabase.from("mtg_collection").insert({
    user_id: userId,
    scryfall_id: card.id,
    card_name: card.name,
    set_code: card.setCode,
    quantity,
    foil,
    condition,
  });
  if (error) throw error;
  logActivityForUser(userId, "mtg_card_added", { title: card.name });
}

export async function updateCollectionEntry(entryId, patch) {
  const { error } = await supabase.from("mtg_collection").update(patch).eq("id", entryId);
  if (error) throw error;
}

export async function removeFromCollection(entryId) {
  const { error } = await supabase.from("mtg_collection").delete().eq("id", entryId);
  if (error) throw error;
}

// Enriches raw collection rows with live Scryfall data (image,
// current price, legalities) — the row itself only stores the stable
// identifiers, not a snapshot of data that goes stale.
export async function enrichCollectionEntry(entry) {
  const card = await getCardById(entry.scryfall_id);
  return { ...entry, card };
}

// ---------- Decks ----------

export async function fetchDecks(userId) {
  const { data, error } = await supabase
    .from("mtg_decks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDeck(userId, name, format = "commander") {
  const { data, error } = await supabase
    .from("mtg_decks")
    .insert({ user_id: userId, name, format })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDeck(deckId, patch) {
  const { error } = await supabase
    .from("mtg_decks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", deckId);
  if (error) throw error;
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from("mtg_decks").delete().eq("id", deckId);
  if (error) throw error;
}

export async function fetchDeckCards(deckId) {
  const { data, error } = await supabase
    .from("mtg_deck_cards")
    .select("*")
    .eq("deck_id", deckId);
  if (error) throw error;
  return data || [];
}

export async function addCardToDeck(deckId, card, { quantity = 1, isSideboard = false } = {}) {
  const { error } = await supabase.from("mtg_deck_cards").insert({
    deck_id: deckId,
    scryfall_id: card.id,
    card_name: card.name,
    quantity,
    is_sideboard: isSideboard,
  });
  if (error) throw error;
}

export async function updateDeckCardQuantity(cardRowId, quantity) {
  const { error } = await supabase.from("mtg_deck_cards").update({ quantity }).eq("id", cardRowId);
  if (error) throw error;
}

export async function removeCardFromDeck(cardRowId) {
  const { error } = await supabase.from("mtg_deck_cards").delete().eq("id", cardRowId);
  if (error) throw error;
}

// Real format-legality checking using Scryfall's own legalities data
// per card — not a guess. Returns which cards (if any) aren't legal
// in the deck's chosen format, so the deck builder can flag them
// honestly instead of silently allowing an illegal deck.
export async function checkDeckLegality(deckCards, format) {
  const enriched = await Promise.all(
    deckCards.map(async (dc) => ({ ...dc, card: await getCardById(dc.scryfall_id) }))
  );
  const illegal = enriched.filter((dc) => dc.card && dc.card.legalities[format] !== "legal");
  return { illegal, enriched };
}
