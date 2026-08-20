// Flesh and Blood — Binders. A user-named group of cards with labels
// + a cover photo, same real pattern as MtgBindersPage.jsx's "binder"
// kind (mtg_binders/fab_binders share the same shape).
//
// NOT built: Set Lists (MTG's other binder kind, pinned to one real
// set as an owned-quantity checklist). goagain.dev's `set` search
// filter was tested live and does NOT actually scope results —
// `type=Hero` correctly narrows 4897 cards to 150, but `set=WTR`
// (Welcome to Rathe, a small starter-level set) returns 862 results
// with duplicate entries, clearly broken or ignored server-side. Per
// this project's rule to never build on an unverified/non-functional
// capability, Set Lists for FaB are on hold until either goagain fixes
// this or a working real alternative is found — flagged here rather
// than shipped broken or silently dropped.
//
// This is a thin adapter over the shared BindersPage.jsx — see that
// file for the actual UI, which has no game-specific knowledge at all.
// FaB's card identity is compound (fab_card_id + printing_unique_id,
// since one card has multiple real printings), unlike MTG/Pokémon's
// single-id identity — isSameCard/findExisting/addOptions below all
// derive the chosen printing from card.printings[0], same as the
// pre-extraction version did.

import {
  fetchBinders, createBinder, updateBinder, deleteBinder,
  fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage,
} from "../lib/fabCollection";
import { searchFabCards } from "../lib/fab";
import BindersPage from "./BindersPage";

function isSameCard(bc, card) {
  const printing = card.printings?.[0];
  return bc.fab_card_id === card.id && bc.printing_unique_id === printing?.printingId;
}

const adapter = {
  lib: { fetchBinders, createBinder, updateBinder, deleteBinder, fetchBinderCards, setBinderCardQuantity, removeBinderCard, uploadCoverImage },

  setLists: null,

  editor: {
    searchCards: async (query) => (await searchFabCards({ name: query })).cards,
    cardSubtitle: (card) => card.typeText,
    findExisting: (binderCards, card) => binderCards.find((bc) => isSameCard(bc, card)),
    isSameCard,
    addOptions: (card, existing) => {
      const printing = card.printings?.[0];
      return {
        printingUniqueId: printing?.printingId || null,
        setId: printing?.setId || null,
        edition: printing?.edition || null,
        foiling: printing?.foiling || null,
        foil: existing?.foil || false,
      };
    },
    quantityChangeCard: (bc) => ({ id: bc.fab_card_id, name: bc.card_name }),
    quantityChangeOptions: (bc) => ({
      printingUniqueId: bc.printing_unique_id,
      setId: bc.set_id,
      edition: bc.edition,
      foiling: bc.foiling,
    }),
    rowMeta: (bc) => (
      <>
        {bc.set_id && <span>{bc.set_id}</span>}
        {bc.foiling && <span>{bc.foiling}</span>}
      </>
    ),
  },

  attributionHref: "https://fabtcg.com",
  attributionText: () => "Card data via goagain.dev · Flesh and Blood is a trademark of Legend Story Studios",
};

export default function FabBindersPage({ userId }) {
  return <BindersPage userId={userId} kind="binder" adapter={adapter} />;
}
