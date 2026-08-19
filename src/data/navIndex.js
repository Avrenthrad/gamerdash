// Quick-jump navigation index — every real, already-built page in the
// app. Shared by Header (search icon) and CommandPalette (Ctrl/Cmd+K)
// so there's one search experience, not two competing ones. This is
// genuine navigation, not a stubbed-out search box: typing filters
// this list and Enter/click jumps straight there — no invented
// "results", just the app's own real pages.
export const NAV_INDEX = [
  { label: "Overview", view: "overview", keywords: "home summary" },
  { label: "Gaming Dashboard", view: "dashboard", keywords: "gaming home" },
  { label: "Library", view: "library", keywords: "gaming games owned" },
  { label: "Market", view: "prices", keywords: "gaming deals prices wishlist" },
  { label: "Backlog", view: "backlog", keywords: "gaming games" },
  { label: "Achievements", view: "achievements", keywords: "gaming trophies xbox playstation steam" },
  { label: "Upcoming Releases", view: "upcoming-releases", keywords: "gaming calendar market" },
  { label: "TCG Home", view: "tcg-home", keywords: "mtg magic cards" },
  { label: "MTG Search", view: "mtg-search", keywords: "tcg magic cards scryfall" },
  { label: "MTG Collection", view: "mtg-collection", keywords: "tcg magic cards" },
  { label: "MTG Deck Builder", view: "mtg-decks", keywords: "tcg magic decks" },
  { label: "MTG Card Scanner", view: "mtg-scan", keywords: "tcg magic ocr" },
  { label: "Import Collection", view: "mtg-import", keywords: "tcg magic csv manabox collectr import" },
  { label: "TCG Marketplace", view: "tcg-marketplace", keywords: "tcg magic buy sell trade listings" },
  { label: "Entertainment", view: "college-entertainment", keywords: "movies tv anime books" },
  { label: "Books", view: "books", keywords: "entertainment tbr barcode isbn reading lists" },
  { label: "Comics", view: "comics", keywords: "entertainment issues pull list" },
  { label: "Collectibles", view: "college-collectibles", keywords: "shelf funko lego statues" },
  { label: "Tabletop", view: "college-tabletop", keywords: "rpg dnd wargames dice" },
  { label: "Guilds", view: "guilds", keywords: "social friends activity crew" },
  { label: "Friends", view: "friends", keywords: "social guilds add friend code" },
  { label: "Account Settings", view: "settings", keywords: "profile avatar theme" },
  { label: "Account Linking", view: "linking", keywords: "steam link connect" },
  { label: "Dashfeed Settings", view: "dashfeed", keywords: "toggles layout" },
];
