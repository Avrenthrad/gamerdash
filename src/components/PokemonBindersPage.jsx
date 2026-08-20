// Pokémon TCG — My Collection — Binders & Set Lists. Same underlying
// table (pokemon_binders), split by `kind`, same shape as
// MtgBindersPage.jsx. Unlike FabBindersPage.jsx, Set Lists ARE built
// here — pokemontcg.io's set.id filter was confirmed live to scope
// correctly (matched a set's own real total card count).
//
// This is a thin adapter over the shared BindersPage.jsx — see that
// file for the actual UI, which has no game-specific knowledge at all.

import {
  fetchBinders, createBinder, createSetList, updateBinder, deleteBinder,
  fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage,
} from "../lib/pokemonCollection";
import { searchPokemonCards, getAllPokemonSets, getPokemonSetCards, nameQuery } from "../lib/pokemon";
import BindersPage from "./BindersPage";

const adapter = {
  lib: { fetchBinders, createBinder, updateBinder, deleteBinder, fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage },

  setLists: {
    fetchAllSets: getAllPokemonSets,
    setKey: (s) => s.id,
    existingSetKeys: (binders) => new Set(binders.map((b) => b.pokemon_set_id)),
    matches: (s, q) => s.name.toLowerCase().includes(q),
    resultLabel: (s) => `${s.name} — ${s.total} cards`,
    searchPlaceholder: "Search a real Pokémon set (e.g. Scarlet & Violet)…",
    emptyStateText: "No set lists yet — search a real Pokémon set above to start a checklist.",
    create: (userId, set) => createSetList(userId, set.id),
    binderSetIconUrl: (binder) => binder.pokemon_set_icon_url || null,
    fetchChecklist: (binder) => getPokemonSetCards(binder.pokemon_set_id),
    checklistMatchesQuery: (card, q, qNumber) =>
      card.name.toLowerCase().includes(q) || card.number === qNumber,
    binderCardKeyField: (bc) => bc.pokemon_card_id,
    checklistSetQuantity: (binderId, card, quantity, extra) =>
      setBinderCardQuantity(binderId, card, quantity, { condition: extra.condition }),
    supportsFoil: false,
    supportsCondition: false,
    checklistErrorText: "Couldn't load this set's checklist right now — Pokémon TCG data is occasionally unavailable, try again in a moment.",
    checklistEmptyText: "No cards found for this set right now.",
  },

  editor: {
    searchCards: async (query) => (await searchPokemonCards(nameQuery(query))).cards,
    cardSubtitle: (card) => card.setName,
    findExisting: (binderCards, card) => binderCards.find((bc) => bc.pokemon_card_id === card.id),
    isSameCard: (bc, card) => bc.pokemon_card_id === card.id,
    addOptions: () => ({}),
    quantityChangeCard: (bc) => ({ id: bc.pokemon_card_id, name: bc.card_name, setId: bc.set_id }),
    quantityChangeOptions: (bc) => ({ finish: bc.finish }),
    rowMeta: (bc) => bc.set_id,
  },

  attributionHref: "https://pokemontcg.io",
  attributionText: () => "Card data via pokemontcg.io",
};

export default function PokemonBindersPage({ userId, kind }) {
  return <BindersPage userId={userId} kind={kind} adapter={adapter} />;
}
