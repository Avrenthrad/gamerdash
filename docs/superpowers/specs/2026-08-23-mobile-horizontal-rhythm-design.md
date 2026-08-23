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

**In scope** — pages/components that currently stack unlike widgets vertically
and are the actual source of the "crowded" feeling:

- The 6 hub/dashboard pages: `OverviewPage`, `GamingDashboard`, `TcgHomePage`,
  `EntertainmentHomePage`, `CollectiblesHomePage`, `TabletopHomePage`
- The ~16 widget/card components rendered inside those hubs: `CurrentRotation`,
  `SteamPresenceCard`, `GuildPulseCard`, `GuildSpotlightCard`,
  `FriendsActivityCard`, `NewsAnnouncementsCard`, `NowTrendingCard`,
  `ReleaseCalendarCard`, `LiveServiceSection`, `LibrarySection`,
  `MarketplaceSection`, `PriceSection`, `GameMasterySection`,
  `GamingMasteryContributionCard`, `RecentActivityCard`,
  `ContinuePlayingCard` — these need a more compact visual treatment sized to
  fit inside a lane card, at mobile width only
- Filter/category chip rows on collection, binder, and search pages (e.g. set
  filters, rarity filters, college quick-switches) — convert from
  wrapped/stacked rows to horizontal-scroll lanes for consistency with the
  hub pages

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

**Card compacting**: each of the ~16 widget components gets a mobile-only CSS
adjustment (same file, gated under the existing mobile media query block at
the end of `index.css`, matching where the nav shell CSS already lives) —
tighter padding, smaller type scale, fixed width when inside a lane. This is
CSS-only; component logic and props are untouched.

**Filter chip lanes**: existing filter-chip row markup gets wrapped in the
same `<HorizontalLane>` primitive (no label, since these are utility rows not
content sections) — same non-breaking desktop behavior, scrollable lane on
mobile.

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
2. Mobile compacting CSS for the 16 widget components
3. Wire `<HorizontalLane>` into the 6 hub pages
4. Filter-chip lane conversion on binder/collection/search pages
5. Full visual pass at 360px/412px across every touched page
