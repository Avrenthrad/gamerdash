# Handoff: Mobile layout restructure (Horizontal Rhythm)

You're picking up a scoped, already-approved design task on Lykodex (a
React/Vite + Capacitor + Tauri collector app, Supabase-backed). The user
found the mobile phone experience "too crowded" and wants it restructured.
The design work is done — this is an implementation handoff, not a fresh
design request.

## Read first

**The full spec:** `docs/superpowers/specs/2026-08-23-mobile-horizontal-rhythm-design.md`
(same folder as this file). It has the complete scope (which pages/components
are in vs. out), the architecture decision and why, data flow, error
handling, and build order. Follow it — don't re-derive the design.

## What was decided and why

Three layout directions were mocked up (phone-frame mockups of the real
Overview screen, using real data and the app's actual design tokens) and
presented to the user. They picked **Direction C — "Horizontal Rhythm"**:
instead of stacking every widget group vertically down the screen (which is
what causes the crowded feeling), each group gets its own
horizontally-scrolling lane — stats in one scrollable row, "right now" cards
in another, college quick-links in another, etc. Same information, much
shorter vertical scroll.

The core new piece is a single reusable wrapper component,
`<HorizontalLane>`, that is a **no-op on desktop** (renders children in
whatever layout the page already uses) and becomes a horizontal-scroll
flex container only at the existing mobile breakpoint. This mirrors how the
app's mobile nav shell already works — CSS-only responsive behavior, no JS
media-query branching, no separate mobile-only page components. Don't
introduce a different pattern; extend this one.

## Design system — use the real tokens, don't invent new ones

Defined in `src/index.css` (`:root` block near the top): colors (`--bg`,
`--surface`, `--text`, `--gold` family, plus semantic accents like `--teal`,
`--violet`, `--rose`), radii (`--radius-sm` through `--radius-pill`), and
fonts (`--font-display`: Bricolage Grotesque, `--font-body`: Hanken Grotesk,
`--font-mono`: JetBrains Mono for stats/numbers). The theme also has a light
variant further down the same file — don't hardcode colors, use the tokens
so both themes keep working.

## Reference mockup

A live artifact exists showing all three directions (C is the chosen one) at
real phone-frame proportions with real app data:
https://claude.ai/code/artifact/34e1e53a-2ec3-4148-8f13-b0b54cf1d93f

## Scope reminder (the spec has the full list — this is the short version)

**Touch:** the 6 hub/dashboard pages (Overview, Gaming, TCG, Entertainment,
Collectibles, Tabletop home), the ~16 widget cards rendered inside them, and
filter-chip rows on collection/binder/search pages.

**Don't touch:** forms/settings pages, item grids themselves (only their
filter bars change), detail views, deck builders, scanners, or the nav shell
(`Header.jsx`'s `.mobile-tab-bar`/drawer — already rebuilt this session,
working correctly, out of scope). Desktop/tablet rendering must stay
pixel-identical before and after — this is additive mobile-only CSS.

## Conventions already established in this codebase

- Mobile-specific CSS lives at the very end of `src/index.css` (a real bug
  earlier in this project came from placing mobile rules earlier in the
  file, where they lost the cascade to later unconditional base rules —
  keep new rules appended at the end).
- The mobile breakpoint is 720px, same one the nav shell already uses.
- No data-fetching, hook, or prop changes anywhere in this work — it's a
  presentation-only restructure. If a page's data logic looks like it needs
  to change to make this work, stop and reconsider the approach rather than
  scope-creeping into a data change.
- Test at 360px and 412px widths (real device sizes already used for
  verification this session), both light and dark theme.

## One live gotcha worth knowing

If you're building/testing the Android app locally on Windows and the
project lives inside a OneDrive-synced folder (it does here), Gradle builds
can fail with file-lock errors (`AccessDeniedException` /
`Unable to delete directory`) because OneDrive holds handles on build
output. If that happens, force-delete `android/build` and
`android/app/build` and rebuild — not a code bug, just a sync-client
collision. This restructure is CSS/JSX only though, so it's unlikely to
come up unless you're doing a full native rebuild to test on-device.
