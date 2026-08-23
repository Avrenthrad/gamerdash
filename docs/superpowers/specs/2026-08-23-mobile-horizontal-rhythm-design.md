# Mobile layout restructure: Horizontal Rhythm

**Status:** Approved for planning
**Scope:** Mobile phone-width breakpoint only (shared by the installed app and mobile-web — same breakpoint, same code, per existing responsive convention)

## Problem

The mobile experience feels crowded. Hub/dashboard-style pages stack many unlike
widgets vertically (stat blocks, "right now" cards, quick links, social feed
cards), producing a long, dense scroll with little visual breathing room. This
is a structural/layout problem, not a data or feature problem — the underlying
data-fetching hooks and page logic are correct and untouched by this work.

Three layout directions were mocked up against the real Overview screen
(see the "Mobile Layout Directions" artifact from this session). The user
selected **Direction C — Horizontal Rhythm**: instead of stacking every
group of content downward, each group (stats, "right now" cards, colleges,
etc.) gets its own horizontally-scrollable lane. The same information exists;
the vertical scroll is dramatically shorter because content spreads sideways
instead of piling down.

## Scope

**Corrected after implementation research** (verified against actual file
contents — see the two threads below for what changed from the first draft
of this scope):

**In scope** — pages/components that currently stack unlike widgets vertically
and are the actual source of the "crowded" feeling:

- **Widget-stacking lanes**: only `OverviewPage` and `GamingDashboard`
  actually stack the named widget components vertically. The other 4 hub
  pages (`TcgHomePage`, `EntertainmentHomePage`, `CollectiblesHomePage`,
  `TabletopHomePage`) don't use these widgets at all — they render a single
  active section based on a tab/filter state, not a stack. Those 4 pages'
  only in-scope change is their tab row (next bullet).
  - `OverviewPage`: `SteamPresenceCard`, `GuildPulseCard`,
    `FriendsActivityCard` (currently three bare, unwrapped conditionals in a
    row — lines 198-200) become one `<HorizontalLane label="Right now">`.
    The `.overview-grid` college quick-link tiles become a second lane.
  - `GamingDashboard`: `SteamPresenceCard` + `CurrentRotation` (bare,
    unwrapped) become one lane. `.gaming-hero-grid`
    (`ContinuePlayingCard`, `GamingMasteryContributionCard`,
    `ReleaseCalendarCard`) becomes a lane. `.gaming-secondary-grid`
    (`GuildSpotlightCard`, `RecentActivityCard`, `NowTrendingCard`,
    `NewsAnnouncementsCard`) becomes a lane.
  - **Exempted from lane treatment** (stay full-width, stacked, below the
    lanes — decided after research showed these don't compact into a narrow
    card without real usability loss): `LiveServiceSection` (two-column
    layout), `LibrarySection` (renders a data table), `GameMasterySection`
    (has two `<details>` forms for manual platform stat entry). These three
    still get mobile-only CSS tightening (padding, type scale) but keep
    their current full-width single-column position in the stack.
  - **Exempted, different reason**: `GamingDashboard`'s drag-to-customize
    mode (the `react-grid-layout` branch, lines 121-159) stays untouched —
    it's an interactive rearrange UI, not a static stack, and forcing it
    into a lane would break the drag/resize interaction. Only the
    non-customizing `.dash-stack` fallback (lines 161-173, which renders
    `PriceSection`/`LiveServiceSection`/`LibrarySection` — the same 3
    exempted widgets above) is affected, and per the exemption above it
    keeps its current stacked layout, just with tightened mobile CSS.

- **Section-tab lanes** (this replaces the original "filter chip" scope item
  below — research found no filter-chip UI on any binder/search page; the
  actual horizontal-row-of-buttons pattern in this codebase is
  `.backlog-status-tabs`, a section switcher, not a filter): convert
  `.backlog-status-tabs` to scroll horizontally instead of wrapping, on:
  `TcgHomePage` (MTG/FaB/Pokémon game switcher), `EntertainmentHomePage`
  (Movies/TV/Anime/Books search-type tabs), `CollectiblesHomePage`
  (Shelf/Add/Hardware/Wishlist/Stats/Marketplace), `TabletopHomePage`
  (RPG/Wargames/Dice/Rules), and the nested tab row inside
  `MarketplaceSection` (Browse/Post/My Listings/My Offers). This is a
  single shared CSS rule (one class, five+ call sites), not five separate
  changes.

~~Filter/category chip rows on collection, binder, and search pages~~ —
**removed**: `MtgBindersPage`/`PokemonBindersPage`/`FabBindersPage`/
`BindersPage`/`MtgSearchPage`/`PokemonSearchPage`/`FabSearchPage` were
checked directly and have no chip-row UI — only text search inputs, a native
`<select>`, and read-only label tags. Nothing to convert there.

**Out of scope** (stays exactly as-is — vertical is the correct pattern here):

- Forms and settings pages: `LoginPage`, `AccountSettingsPage`,
  `AccountLinkingPage`, `DashfeedSettingsPage`, `OnboardingWelcomeStep`,
  `OnboardingCollegePicker`
- Item grids themselves on binder/collection/search pages (`MtgBindersPage`,
  `PokemonBindersPage`, `FabBindersPage`, `BindersPage`, `MtgCollectionPage`,
  `PokemonCollectionPage`, `FabCollectionPage`, `LibraryPage`, `BooksPage`,
  `ComicsPage`, `BacklogPage`) — only their filter bars change, per above
- Detail views, deck builders, modals, scanners, barcode readers
- The nav shell (`Header.jsx`'s `.mobile-tab-bar` / drawer) — already rebuilt
  earlier this session, not part of this work
- Desktop/tablet layout — completely untouched; this is additive CSS gated to
  the existing mobile breakpoint, same convention as the nav shell

## Architecture

**Follow the existing responsive convention exactly**: the nav shell
(`.mobile-tab-bar`, `.drawer-mobile-only`) already solves "different layout
below 720px" by rendering the mobile markup unconditionally in the DOM and
toggling visibility purely via CSS media query — no JS breakpoint detection,
no conditional component trees, no hydration branching. This work uses the
same approach, extended one level further:

**New shared component: `<HorizontalLane>`** (`src/components/mobile/HorizontalLane.jsx`)

A layout-only wrapper, no data logic:

```jsx
<HorizontalLane label="Right now">
  <CurrentRotation ... />
  <SteamPresenceCard ... />
  <ReleaseCalendarCard ... />
</HorizontalLane>
```

- Renders an optional `label` (matches the `.a-section-title` / lane-title
  style from the mockup) and a `<div className="h-lane">` wrapping its
  children.
- On desktop (above the breakpoint), `.h-lane` is unstyled — children render
  in whatever normal stacked/grid layout the page already uses today.
  **This means `<HorizontalLane>` can wrap existing widget lists without
  changing desktop rendering at all** — it's an additive, non-breaking
  wrapper on desktop.
- Below the breakpoint, `.h-lane` switches to `display: flex; overflow-x:
  auto; gap: ...; scroll-snap-type: x proximity;`, and each direct child
  gets `flex: 0 0 auto` with a fixed lane-card width via a CSS descendant
  rule — no per-child markup changes required.

**Card compacting**: the 13 lane-eligible widgets (excludes the 3 exempted
above) get a mobile-only CSS adjustment — tighter padding, smaller type
scale, fixed width when inside a lane. Most share the `.panel.hero-card`
base class (`GuildSpotlightCard`, `NewsAnnouncementsCard`, `NowTrendingCard`,
`ReleaseCalendarCard`, `GamingMasteryContributionCard`, `RecentActivityCard`,
`ContinuePlayingCard` — the last needs an extra override for its
`hero-card--continue-playing` art image), so one shared rule covers most of
them; `CurrentRotation` (`.current-rotation`), `GuildPulseCard`
(`.panel.guild-pulse`), and `FriendsActivityCard`
(`.presence-card.friends-activity-card`) need their own rules since they
don't share the base class. This is CSS-only; component logic and props are
untouched.

**CSS location**: the existing mobile media query block lives at
`src/index.css` lines 7194-7326 (`@media (max-width: 720px) { ... }`,
preceded by a comment explaining why it's placed late in the file — cascade
order beats an earlier unconditional base rule of equal specificity). The
file continues to line 7364 after that block (an unrelated
`.tcg-visual-scanner` section with no media query). New rules append a
second `@media (max-width: 720px) { ... }` block immediately after line
7326 — not literally at end-of-file, just after the existing mobile block.

**Section-tab lanes**: `.backlog-status-tabs` gets a mobile-only rule
switching it from wrap/flex to `overflow-x: auto` with `flex: 0 0 auto` on
its button children — no JSX changes needed at any of the 5 call sites,
since they all already share this one class.

### Why this approach over alternatives

- **Alternative: JS-driven conditional rendering** (a `useMediaQuery` hook
  branching which JSX tree renders) was rejected — it contradicts the
  existing, working convention from the nav shell, adds a re-render on
  resize, and risks a flash of wrong layout on load. CSS-only matches what's
  already proven to work in this codebase.
- **Alternative: separate mobile-only page components** (e.g.
  `OverviewPageMobile.jsx`) was rejected — doubles the maintenance surface
  and diverges data-fetching logic between two copies of the same page. The
  `<HorizontalLane>` wrapper achieves the layout change without forking any
  page's logic.

## Data flow

Unchanged. Every hub page and widget component keeps its existing data
fetching, state, and props exactly as they are today. This is purely a
presentation-layer restructure: existing JSX gets grouped into
`<HorizontalLane>` wrappers, and existing CSS classes get new mobile-width
rules. No hook, no API call, no Supabase query changes anywhere in this work.

## Error handling

No change to error states themselves (each widget already handles its own
loading/error/empty states, e.g. `SteamPresenceCard`'s "Couldn't reach
Steam's status right now"). Those states now render inside a lane card
instead of a full-width stacked card — same message, same logic, narrower
container.

## Testing

- Visual verification at the two real breakpoints already used in the
  codebase's responsive testing (this session verified 360px and 412px
  device widths for the earlier nav shell work) — confirm horizontal scroll
  works, snap points land cleanly, no horizontal page-level scroll leaks
  (the earlier "sliding/overlapping" bug this session was actually a
  pinch-zoom issue, not a layout bug — worth re-confirming zoom lock still
  holds with the new lanes).
- Confirm desktop rendering is pixel-identical before/after for every touched
  page (the `<HorizontalLane>` wrapper must be a true no-op above the
  breakpoint).
- Confirm each of the 16 widget components still renders its loading/error/
  empty states correctly at the new compact width.

## Build order

All pages/components in scope, in one pass (per user's explicit preference —
build the whole thing before shipping, not an incremental page-by-page
release):

1. `<HorizontalLane>` primitive + its CSS (desktop no-op + mobile lane
   behavior)
2. Mobile compacting CSS for the 13 lane-eligible widgets + separate
   tightening CSS for the 3 exempted (full-width) widgets
3. Wire `<HorizontalLane>` into `OverviewPage` (2 lanes) and
   `GamingDashboard` (2 lanes) — the only 2 pages with widget stacks
4. `.backlog-status-tabs` horizontal-scroll conversion (1 CSS rule, 5 call
   sites: `TcgHomePage`, `EntertainmentHomePage`, `CollectiblesHomePage`,
   `TabletopHomePage`, `MarketplaceSection`)
5. Full visual pass at 360px/412px across all 6 touched pages, both themes
