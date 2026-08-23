# Mobile Horizontal Rhythm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace vertical widget-stacking on Lykodex's two busiest mobile hub pages (Overview, Gaming Dashboard) with horizontally-scrolling lanes, and make section-tab rows scroll instead of wrap, without changing desktop rendering at all.

**Architecture:** A single new wrapper component, `<HorizontalLane>`, renders its children inside a `.h-lane` div. `.h-lane` is unstyled above the existing 720px breakpoint (children render exactly as they do today) and becomes a horizontal-scroll flex row below it — same CSS-only, no-JS-branching convention the mobile nav shell already uses. Widget cards get mobile-only compacting CSS so they fit a lane; three structurally-heavy widgets are exempted and stay full-width. `.backlog-status-tabs` gets a matching mobile-only overflow-scroll rule.

**Tech Stack:** React 18 (JSX, no new deps), plain CSS (existing custom-property token system in `src/index.css`), no test framework in this repo — verification is manual visual checks via the Claude Browser tools at real device widths.

**Spec:** `docs/superpowers/specs/2026-08-23-mobile-horizontal-rhythm-design.md`

## Global Constraints

- Mobile breakpoint is exactly `@media (max-width: 720px)` — match this value everywhere, don't introduce a second breakpoint.
- Desktop/tablet rendering (above 720px) must be pixel-identical before and after every task — `.h-lane` and all new classes are no-ops above the breakpoint.
- No changes to data fetching, hooks, or component props anywhere in this plan — every task is JSX-structure + CSS only.
- New mobile CSS is appended in `src/index.css` immediately after line 7326 (the closing `}` of the existing `@media (max-width: 720px)` mobile-shell block) — not literally end-of-file (the file continues to line 7364 with an unrelated `.tcg-visual-scanner` section). Confirm the insertion point with a fresh `Read` before editing, since earlier tasks in this plan will have already changed the file's line numbers by the time later tasks run.
- Use existing design tokens only (`--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--gold`/`--red` family, `--font-display`, `--font-body`, `--font-mono`, `--radius-*`) — no new hardcoded colors or fonts.
- The 3 exempted widgets (`LiveServiceSection`, `LibrarySection`, `GameMasterySection`) never get wrapped in `<HorizontalLane>` — they stay full-width, stacked, in their current position, with only mobile padding/type CSS applied directly to their existing root classes.
- `GamingDashboard`'s drag-to-customize mode (`customizingLayout === true`, the `react-grid-layout` branch) is untouched by this plan — only the non-customizing `.dash-stack` fallback branch gets mobile CSS tightening (same 3 exempted widgets, so this is covered by the constraint above, not new work).

---

### Task 1: `<HorizontalLane>` primitive component + core CSS

**Files:**
- Create: `src/components/mobile/HorizontalLane.jsx`
- Modify: `src/index.css:7326` (insert new block immediately after this line, before the `.tcg-visual-scanner` comment on line 7328)

**Interfaces:**
- Produces: `HorizontalLane` — default export, props `{ label?: string, className?: string, children: ReactNode }`. Later tasks import this from `../mobile/HorizontalLane` (from `src/components/*.jsx`) and wrap existing JSX with it: `<HorizontalLane label="...">{...}</HorizontalLane>` or `<HorizontalLane className="existing-grid-class">{...}</HorizontalLane>` to preserve an existing container's desktop CSS while adding mobile lane behavior.

- [ ] **Step 1: Create the component**

Create `src/components/mobile/HorizontalLane.jsx`:

```jsx
// Layout-only wrapper — no data logic. Renders children inside a lane
// that's a no-op on desktop (children keep whatever layout the page
// already gives them via `className`) and becomes a horizontal-scroll
// row only at the existing mobile breakpoint — same CSS-only,
// no-JS-branching convention as the mobile-tab-bar/drawer in
// Header.jsx. `label` renders as a small section title, mobile-only
// (hidden on desktop so this never adds new visible text there).
export default function HorizontalLane({ label, className, children }) {
  return (
    <div className="h-lane-wrap">
      {label && <p className="h-lane-title">{label}</p>}
      <div className={`h-lane${className ? ` ${className}` : ""}`}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the core lane CSS**

Read `src/index.css` around line 7326 first to confirm the exact current line number of the mobile-shell block's closing brace (it may have shifted from 7326 if anything upstream changed), then insert this block immediately after it:

```css
/* ---------- Horizontal Rhythm: lane primitive for mobile hub pages
   ---------- see docs/superpowers/specs/2026-08-23-mobile-horizontal-
   rhythm-design.md. `.h-lane` is a no-op above the breakpoint — the
   `className` prop on <HorizontalLane> is what carries a container's
   existing desktop layout (e.g. "gaming-hero-grid" keeps its current
   grid CSS untouched on desktop). ---------- */

.h-lane-title {
  display: none;
}

@media (max-width: 720px) {
  .h-lane-title {
    display: block;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 18px 4px 8px;
  }

  .h-lane {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 2px 2px 6px;
    scroll-snap-type: x proximity;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .h-lane::-webkit-scrollbar {
    display: none;
  }

  .h-lane > * {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
}
```

- [ ] **Step 3: Verify it's a true no-op on desktop**

Run: `npm run dev` (or use the already-running dev server), open the app in the Claude Browser tools at desktop width (1280px), navigate to the Overview page. Nothing should look different yet — `<HorizontalLane>` isn't imported anywhere else yet, and `.h-lane`/`.h-lane-title` have no effect above 720px even once it is. This step just confirms the CSS insertion didn't break anything (check `read_console_messages` for CSS parse errors — there won't be any from valid CSS, but confirm the page still renders).

- [ ] **Step 4: Commit**

```bash
git add src/components/mobile/HorizontalLane.jsx src/index.css
git commit -m "Add HorizontalLane mobile layout primitive"
```

---

### Task 2: Wire `<HorizontalLane>` into OverviewPage + compact its 3 lane widgets

**Files:**
- Modify: `src/components/OverviewPage.jsx:198-200` (the bare `SteamPresenceCard`/`GuildPulseCard`/`FriendsActivityCard` trio) and `:202` (the `.overview-grid` opening tag) / `:296` (its closing tag)
- Modify: `src/index.css` (append after Task 1's new block)

**Interfaces:**
- Consumes: `HorizontalLane` from Task 1 (`src/components/mobile/HorizontalLane.jsx`), default export, props `{ label?, className?, children }`.

- [ ] **Step 1: Import HorizontalLane**

In `src/components/OverviewPage.jsx`, add near the other local imports (after the `CollegeMorphHero` import, currently line 20):

```jsx
import HorizontalLane from "./mobile/HorizontalLane";
```

- [ ] **Step 2: Wrap the bare widget trio in a lane**

Replace (currently lines 198-200):

```jsx
      {showGaming && isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}
      {isLoggedIn && <GuildPulseCard userId={userId} onGoToGuilds={onGoToGuilds} />}
      {isLoggedIn && <FriendsActivityCard userId={userId} onGoToFriends={onGoToFriends} />}
```

with:

```jsx
      <HorizontalLane label="Right now">
        {showGaming && isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}
        {isLoggedIn && <GuildPulseCard userId={userId} onGoToGuilds={onGoToGuilds} />}
        {isLoggedIn && <FriendsActivityCard userId={userId} onGoToFriends={onGoToFriends} />}
      </HorizontalLane>
```

Note: if none of the three conditions are true (logged out), `<HorizontalLane>` renders an empty `.h-lane-wrap` with just the label and no cards. Add a guard so the label doesn't show with nothing under it — change the wrapping condition to only render the lane when logged in, since all three cards require `isLoggedIn`:

```jsx
      {isLoggedIn && (
        <HorizontalLane label="Right now">
          {showGaming && <SteamPresenceCard linkedSteamId={linkedSteamId} />}
          <GuildPulseCard userId={userId} onGoToGuilds={onGoToGuilds} />
          <FriendsActivityCard userId={userId} onGoToFriends={onGoToFriends} />
        </HorizontalLane>
      )}
```

- [ ] **Step 3: Convert the college quick-link grid into a lane**

Replace the opening tag (currently line 202):

```jsx
      <div className="overview-grid">
```

with:

```jsx
      <HorizontalLane label="Colleges" className="overview-grid">
```

And replace the matching closing tag (currently line 296):

```jsx
      </div>
```

with:

```jsx
      </HorizontalLane>
```

(This is the closing tag immediately before the final `</div>` that closes `.overview-page` — confirm with a fresh read of the file before editing, since Step 2 shifted line numbers.)

- [ ] **Step 4: Add mobile-compacting CSS for the 3 "Right now" widgets**

Append to `src/index.css`, inside the same `@media (max-width: 720px)` block added in Task 1 (add these rules before that block's closing `}`):

```css
  .h-lane > .presence-card,
  .h-lane > .panel.guild-pulse {
    width: 240px;
    padding: 14px;
  }

  .h-lane > .presence-card .presence-card__title,
  .h-lane > .panel.guild-pulse .panel__eyebrow {
    font-size: 13px;
  }

  .h-lane > .friends-activity-card {
    width: 240px;
    padding: 14px;
  }
```

- [ ] **Step 5: Add mobile-compacting CSS for the college grid lane**

`.overview-grid`'s own `display: grid` rule (`src/index.css:5747-5751`) is an unconditional base rule with the same specificity as `.h-lane`'s flex rule — since `.h-lane`'s rule lives later in the file (inside the Task 1 media block), it already wins by source order, same mechanism as the nav shell. No extra display override needed — just size the children. Add inside the same media block:

```css
  .h-lane.overview-grid > .overview-card {
    width: 132px;
    min-width: 132px;
  }
```

- [ ] **Step 6: Visual verification**

Use the Claude Browser tools: `resize_window` to 412x915 (a real device size already used for verification earlier in this project), navigate to the Overview page, screenshot. Confirm:
- The "Right now" label appears above a horizontally-scrollable row containing the Steam/Guild/Friends cards (or fewer, if logged out you'll see none — test both logged-in and logged-out states)
- The "Colleges" label appears above a horizontally-scrollable row of quick-link tiles
- Scrolling each lane horizontally works (use `computer` action `scroll` with `scroll_direction: "left"`/`"right"` inside the lane's bounding box)
- No page-level horizontal scroll (the lanes scroll internally, the page body doesn't)

Then `resize_window` to desktop (1280px), screenshot, and confirm it's pixel-identical to how Overview looked before this task (same stacked layout, no lanes visible).

- [ ] **Step 7: Commit**

```bash
git add src/components/OverviewPage.jsx src/index.css
git commit -m "Wire HorizontalLane into OverviewPage"
```

---

### Task 3: Wire `<HorizontalLane>` into GamingDashboard + compact its lane widgets

**Files:**
- Modify: `src/components/GamingDashboard.jsx:61-69` (bare `SteamPresenceCard` + `CurrentRotation`), `:72-88` (`.gaming-hero-grid`), `:91-110` (`.gaming-secondary-grid`)
- Modify: `src/index.css` (append to the same media block)

**Interfaces:**
- Consumes: `HorizontalLane` from Task 1.

- [ ] **Step 1: Import HorizontalLane**

In `src/components/GamingDashboard.jsx`, add after the `PageLoadingFallback` import (currently line 23):

```jsx
import HorizontalLane from "./mobile/HorizontalLane";
```

- [ ] **Step 2: Wrap the bare Steam + Rotation pair**

Replace (currently lines 61-69):

```jsx
      {isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}

      <CurrentRotation
        wishlist={wishlist}
        linkedSteamId={linkedSteamId}
        userId={userId}
        onOpenBacklog={() => goTo("backlog")}
        onOpenPrices={() => goTo("prices")}
      />
```

with:

```jsx
      <HorizontalLane label="Right now">
        {isLoggedIn && <SteamPresenceCard linkedSteamId={linkedSteamId} />}
        <CurrentRotation
          wishlist={wishlist}
          linkedSteamId={linkedSteamId}
          userId={userId}
          onOpenBacklog={() => goTo("backlog")}
          onOpenPrices={() => goTo("prices")}
        />
      </HorizontalLane>
```

(`CurrentRotation` always renders regardless of `isLoggedIn` today, so unlike Task 2's trio, no outer guard is needed here — the lane always has at least `CurrentRotation` in it.)

- [ ] **Step 3: Convert the hero grid into a lane**

Replace the opening tag (currently line 72):

```jsx
      <div className="gaming-hero-grid">
```

with:

```jsx
      <HorizontalLane label="Your progress" className="gaming-hero-grid">
```

And its closing tag (currently line 88):

```jsx
      </div>
```

becomes:

```jsx
      </HorizontalLane>
```

- [ ] **Step 4: Convert the secondary grid into a lane**

Replace the opening tag (currently line 91, after line-number shifts from Step 3 — confirm with a fresh read):

```jsx
      <div className="gaming-secondary-grid">
```

with:

```jsx
      <HorizontalLane label="Social" className="gaming-secondary-grid">
```

And its closing tag (currently line 110):

```jsx
      </div>
```

becomes:

```jsx
      </HorizontalLane>
```

- [ ] **Step 5: Add mobile-compacting CSS for the newly-laned widgets**

Append inside the same media block in `src/index.css`:

Same as Task 2 Step 5: `.gaming-hero-grid`/`.gaming-secondary-grid`'s own `display: grid` rule (`src/index.css:4135-4141`) is an unconditional base rule of equal specificity to `.h-lane`'s flex rule, which lives later in the file and already wins by source order — no extra display override needed.

```css
  .h-lane > .current-rotation {
    width: 260px;
    padding: 14px;
  }

  .h-lane.gaming-hero-grid > .panel.hero-card,
  .h-lane.gaming-secondary-grid > .panel.hero-card {
    width: 220px;
  }

  .h-lane.gaming-hero-grid > .hero-card--continue-playing {
    width: 260px;
  }

  .h-lane.gaming-hero-grid > .hero-card--continue-playing .hero-card__art {
    height: 120px;
  }
```

- [ ] **Step 6: Add mobile tightening CSS for the 3 exempted full-width widgets**

These stay full-width and un-laned, but still get lighter mobile padding/type per the spec. Append inside the same media block:

```css
  .panel--wide,
  .panel--rose,
  .steam-link-card {
    padding: 16px;
  }

  .feed-layout {
    flex-direction: column;
  }

  .library-table {
    font-size: 12.5px;
  }

  .mastery-ps-grid {
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  }
```

(These are conservative, low-risk tightening rules targeting classes already confirmed in the research pass — `LiveServiceSection` is `.panel.panel--sky.panel--wide` with a `.feed-layout` two-column div inside it that should stack under 720px; `LibrarySection` is `.panel.panel--rose` with a `.library-table`; `GameMasterySection` is `.steam-link-card` with a `.mastery-ps-grid`. If any of these selectors turn out to already have a conflicting mobile rule elsewhere, prefer increasing this rule's specificity — e.g. wrapping in the same media block already does that relative to the unconditional base rule — over `!important`.)

- [ ] **Step 7: Visual verification**

Same process as Task 2 Step 6: `resize_window` to 412x915, navigate to the Gaming Dashboard (both logged-in and logged-out states, since several cards branch on `isLoggedIn`), screenshot, confirm all 3 lanes scroll horizontally and the 3 exempted widgets (Price/LiveService/Library, in `.dash-stack`) remain full-width and stacked below the lanes. Then verify desktop (1280px) is pixel-identical to before this task. Also check the drag-to-customize mode (`customizingLayout === true`) at both widths — it should render exactly as it did before this task, since it was never touched.

- [ ] **Step 8: Commit**

```bash
git add src/components/GamingDashboard.jsx src/index.css
git commit -m "Wire HorizontalLane into GamingDashboard"
```

---

### Task 4: `.backlog-status-tabs` horizontal-scroll conversion

**Files:**
- Modify: `src/index.css` only — no JSX changes, since all 5 call sites (`TcgHomePage`, `EntertainmentHomePage`, `CollectiblesHomePage`, `TabletopHomePage`, `MarketplaceSection`) already share the one `.backlog-status-tabs` class.

**Interfaces:** None — pure CSS, no new component interface.

- [ ] **Step 1: Add the mobile override**

The existing base rule (`src/index.css:4856-4860`) is:

```css
.backlog-status-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
```

Append inside the same media block used by Tasks 1-3:

```css
  .backlog-status-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .backlog-status-tabs::-webkit-scrollbar {
    display: none;
  }

  .backlog-status-tabs > * {
    flex: 0 0 auto;
  }
}
```

(This closes the media block — confirm this is the last rule needed before the closing `}`, or adjust placement if later tasks in this plan add more rules after it.)

- [ ] **Step 2: Visual verification**

At 412px width, navigate to each of the 5 pages/sections (`TcgHomePage`, `EntertainmentHomePage`, `CollectiblesHomePage`, `TabletopHomePage`, and open `MarketplaceSection` from the Gaming Dashboard's `.dash-stack`), screenshot each, confirm the tab row scrolls horizontally instead of wrapping to a second line. Verify desktop (1280px) unchanged for all 5.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Make backlog-status-tabs scroll horizontally on mobile"
```

---

### Task 5: Full cross-page visual verification pass

**Files:** None modified — verification only.

- [ ] **Step 1: 360px width pass, dark theme**

`resize_window` to 360x800 (the narrower of the two real device widths used earlier in this project). For each of: Overview (logged in + logged out), Gaming Dashboard (logged in + logged out, both customizing-mode on and off), and the 5 `.backlog-status-tabs` locations from Task 4 — screenshot and confirm no layout regressions: no horizontal page-level scroll, no lane content clipped or overlapping, no broken card at the lane's start/end.

- [ ] **Step 2: 412px width pass, light theme**

Switch the app to light theme (existing theme toggle), `resize_window` to 412x915, repeat the same page/state list from Step 1, screenshot each, confirm colors/contrast look correct in the light palette (the CSS added in Tasks 1-4 uses only existing tokens, so this should require no new rules — this step is a check, not expected to produce new code).

- [ ] **Step 3: Desktop regression pass**

`resize_window` to 1280px (desktop), repeat the same page/state list one more time, confirm every page is pixel-identical to its pre-this-plan appearance (stacked layout, no lanes, no mobile-only labels visible, `.backlog-status-tabs` wrapping as before).

- [ ] **Step 4: Fix any issues found**

If any step above surfaces a real regression, fix it in the relevant task's files (don't create a new task file for this — amend forward with a new commit referencing which task's work it corrects).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Fix mobile horizontal-rhythm visual regressions found in verification pass"
```

(Skip this commit if Step 4 found nothing to fix.)
