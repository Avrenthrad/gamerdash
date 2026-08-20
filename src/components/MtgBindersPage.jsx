// TCG My Collection — Binders & Set Lists tabs. Same underlying table
// (mtg_binders), split by `kind`:
//   "binder"   — a user-named group of cards with labels + a cover photo.
//   "set_list" — pinned to one real Scryfall set (name/icon come straight
//                from Scryfall's own Set API — see lib/scryfall.js) and
//                its cards double as that set's owned-quantity checklist.
// Rendered twice from MtgCollectionPage.jsx, once per kind.
//
// This is a thin adapter over the shared BindersPage.jsx — see that
// file for the actual UI, which has no game-specific knowledge at all.

import {
  fetchBinders, createBinder, createSetList, updateBinder, deleteBinder,
  fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage,
} from "../lib/mtg";
import { searchCards, getAllSets, getSetCards } from "../lib/scryfall";
import BindersPage from "./BindersPage";

// Standard 5-point TCG grading scale — same one TCGplayer/Card Kingdom
// use, matches mtg_binder_cards.condition / mtg_collection.condition.
const CARD_CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];

const adapter = {
  lib: { fetchBinders, createBinder, updateBinder, deleteBinder, fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage },

  setLists: {
    fetchAllSets: getAllSets,
    setKey: (s) => s.code,
    existingSetKeys: (binders) => new Set(binders.map((b) => b.set_code)),
    matches: (s, q) => s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q,
    resultLabel: (s) => `${s.name} (${s.code.toUpperCase()}) — ${s.cardCount} cards`,
    searchPlaceholder: "Search a real Magic set (e.g. Dominaria United)…",
    emptyStateText: "No set lists yet — search a real Magic set above to start a checklist.",
    create: (userId, set) => createSetList(userId, set.code),
    binderSetIconUrl: (binder) => binder.scryfall_set_icon_url || null,
    fetchChecklist: (binder) => getSetCards(binder.set_code),
    checklistMatchesQuery: (card, q, qNumber) =>
      card.name.toLowerCase().includes(q) || (card.collectorNumber && card.collectorNumber.toLowerCase() === qNumber),
    binderCardKeyField: (bc) => bc.scryfall_id,
    checklistSetQuantity: (binderId, card, quantity, extra) =>
      setBinderCardQuantity(binderId, card, quantity, { foil: extra.foil, condition: extra.condition }),
    supportsFoil: true,
    supportsCondition: true,
    cardConditions: CARD_CONDITIONS,
    checklistErrorText: "Couldn't load this set's checklist right now.",
    checklistEmptyText: "Scryfall didn't return any cards for this set.",
  },

  editor: {
    searchCards: async (query) => (await searchCards(query)).cards,
    cardSubtitle: (card) => card.setName,
    findExisting: (binderCards, card) => binderCards.find((bc) => bc.scryfall_id === card.id),
    isSameCard: (bc, card) => bc.scryfall_id === card.id,
    addOptions: (card, existing) => ({ foil: existing?.foil || false }),
    quantityChangeCard: (bc) => ({ id: bc.scryfall_id, name: bc.card_name, setCode: bc.set_code }),
    quantityChangeOptions: (bc) => ({ foil: bc.foil }),
    rowMeta: (bc) => bc.set_code?.toUpperCase(),
  },

  attributionHref: "https://scryfall.com",
  attributionText: (isSetList) => `Card data${isSetList ? ", set info," : ""} and pricing powered by Scryfall`,
};

export default function MtgBindersPage({ userId, kind }) {
  return <BindersPage userId={userId} kind={kind} adapter={adapter} />;
}
