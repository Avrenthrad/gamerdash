# Handoff notes — Claude Code ⇄ Cursor

This file is the shared source of truth between the two agents working on
Lykodex. There's no live link between us — no shared session, no direct
API — so this doc, plus commit messages/PR descriptions and code comments,
is how context actually crosses over. Keep it current: whoever picks up a
thread the other one dropped should be able to read this and know what's
going on without re-deriving it.

**Starting point (2026-08-27):** `main` is the only stream. Old V0 chats
were archived; the stalled `v0/runtime-error-resolution-baf343a0` branch
(Commander View / social analytics / college-hero rewrite) was deleted
unmerged — do not recreate it or port from memory. New UI starts from
isolated V0 screens against `DESIGN_TOKENS.md`, wired into this repo on
`main`.

**Division of labor (as of 2026-08-27):** V0 generates isolated UI
screens/components from `DESIGN_TOKENS.md` — never the full app. Cursor
owns wiring that UI into the real Vite app and general feature build-out.
Claude Code owns troubleshooting, testing/verification, and some feature
builds of its own (backend/Supabase work, native platform plumbing, bug
fixes) — delegated by the user per-task, not a fixed split. If you're
picking up a task the other agent started, check the "In progress /
recently touched" section below first.

**If you're V0:** design ONE screen/component at a time against
`DESIGN_TOKENS.md`, in isolation — do not try to import or boot this
full repo in your own preview. See the gotchas below for why that
reliably breaks (your embedded preview pane parses this project's
Tailwind CSS `@import`s as JavaScript and throws `SyntaxError:
Unexpected token '*'` — confirmed not a bug in the actual code, which
builds and runs clean everywhere else it's been tested).

## Project shape

- React 19 + Vite, hash-based custom routing (no react-router) — see
  `src/context/AppContext.jsx`'s `KNOWN_VIEWS`/`parseHash`/`hashFor`.
- Capacitor (Android/iOS) + Tauri (desktop) for packaged builds. Platform
  detection lives in `src/lib/platform.js`
  (`isPackagedApp()`/`isTauri()`/`isAndroid()`/`isMobileApp()`) — branch on
  these, don't re-derive platform checks inline.
- Supabase Postgres backend, project id `zcwrlnljtfvslldwyldq`. RLS almost
  everywhere; cross-user lookups go through narrow `SECURITY DEFINER` RPCs
  (e.g. `get_public_profiles`, friend-scoped `get_friends_*` functions) —
  never widen an existing RPC's exposure without checking who else calls it
  for a narrower reason.
- Vercel serverless functions under `/api/*` proxy anything that needs a
  server-side key (Steam, etc.) or that blocks direct browser requests.
- CI: `.github/workflows/release-android.yml` /
  `release-desktop.yml`, tag pattern `android-v0.1.X` / `desktop-v0.1.X`,
  versioned via `github.run_number`.

## Conventions worth matching

- No comments explaining *what* code does — only *why*, when it's a real
  gotcha/constraint/history that isn't obvious from reading it. Match the
  existing comment density and tone; don't add narration.
- Every commit message explains why, not just what — read recent `git log`
  before writing one, the style is consistent and worth continuing.
- Before committing: `npx oxlint <touched files>` then `npm run build`.
  Both must be clean. If a change is visually observable, verify it live
  (dev server via the browser, not just a build check) before calling it
  done.
- Honest empty states over fabricated data — if something has no real
  history/content yet, say so in the UI rather than inventing a number or
  a fake trend.

## Sharp edges / gotchas actually hit this project

- **`git add <file>` stages the whole file, not just your intended diff.**
  This broke 3 release builds in a row (2026-08-25/26): an in-progress,
  uncommitted Tailwind CSS integration was sitting in `src/index.css`
  alongside unrelated CSS edits, and got swept into a commit without its
  `package.json`/`vite.config.js` companions, breaking `npm ci` in CI.
  Before staging a file you didn't fully author this session, `git diff`
  it first and check nothing unrelated is riding along.
- **Windows vs. Linux CI is case-sensitive for imports.** Windows dev
  environments resolve `import "./Foo"` against `foo.js` without
  complaint; the Linux GitHub Actions runners won't. Double-check new
  file import paths match exact on-disk casing (`git ls-files` reports
  the real case) before assuming a local build success means CI will
  agree.
- **Google/Apple/Microsoft OAuth aren't enabled in Supabase yet** (Discord
  and Twitch are). `src/lib/auth.js`'s `fetchEnabledOAuthProviders()`
  checks Supabase's own public `/auth/v1/settings` endpoint up front and
  disables not-yet-enabled provider buttons — don't remove that check,
  it's there because attempting a disabled provider anyway lands on a raw
  Supabase JSON error page, not a catchable JS error.
- **Packaged-app OAuth needs a different flow than web.** `signInWithOAuth`
  branches on `isPackagedApp()`: web does a normal same-window redirect;
  packaged apps get `skipBrowserRedirect: true`, open the URL in an
  external browser (Capacitor's `Browser.open` on mobile,
  `@tauri-apps/plugin-shell`'s `open()` on desktop — never Tauri's own
  webview, most providers refuse to authenticate inside an embedded
  webview), and the redirect comes back via a registered
  `lykodex://auth-callback` custom scheme
  (`android/.../AndroidManifest.xml`, `ios/.../Info.plist`,
  `src-tauri/tauri.conf.json`'s deep-link plugin config) —
  `src/lib/oauthRedirect.js` catches that and calls `setSession()`
  manually, since there's no real page navigation for Supabase's own
  `detectSessionInUrl` to catch.
- **`mastery_score_history`** is a new table + daily `pg_cron` snapshot job
  (see the `add_mastery_score_history` migration) — `overall_mastery_score`
  itself is still a live-computed, current-value-only column with no
  history of its own; don't assume other "Mastery"-adjacent columns have
  history without checking.
- **A file exporting both a component and a hook/constant breaks Vite Fast
  Refresh** into a full-page reload on every edit (oxlint's
  `only-export-components` catches this). Established fix pattern in this
  repo: move the non-component export to its own file in `lib/` or
  `hooks/`, not into the same file with a re-export.
- **`src/index.css` is one long flat file with no layers, so `@media`
  blocks lose to any same-specificity base rule declared later.** Hit
  again on 2026-08-27: a `@media (max-width: 480px)` block sat next to
  the `.auth-*` rules around line 1660 but also targeted
  `.account-gate-page` and `.onboarding-*`, which define their own
  padding ~2000-4000 lines further down — so the phone padding silently
  never applied. Put responsive overrides at the very end of the file
  (or verify every selector in the block is defined above it).
- **The `Browser pane` local preview tool can't take real screenshots** in
  this environment (times out — "pane not displayed"). Structural
  verification (console errors, `read_page`/`get_page_text`, computed
  styles/bounding rects via the JS eval tool) works fine; for genuine
  pixel-level review, publish a small standalone HTML preview as an
  Artifact instead and have the user look at that.

## Open branches

`main` is where all active work happens. One archive-only branch,
`mobile-paused-2026-08-29` — a full snapshot of the native Android/iOS/
Capacitor setup exactly as it stood before mobile got pulled off `main`
(see the entry directly below). Not for active development; it exists
purely so that setup is fully recoverable if/when mobile work resumes.

## In progress / recently touched (most recent first)

- 2026-08-30 — **Accent now defaults per-page until customized: gold
  on Overview, red on the 5 College homes.** Discovered along the way:
  the write-back effect in `AppContext.jsx` has always saved
  `accent_color` on every profile edit regardless of whether the user
  ever opened the theme picker, so a non-null `accent_color` alone
  can't tell "genuinely chose gold" apart from "never touched it."

  Added a real `profiles.accent_customized` boolean (migration
  `add_accent_customized_flag`), set only via the new
  `setAccentColorExplicit()` in `AppContext.jsx` — used exclusively by
  the swatch row in `AccountSettingsPage.jsx`. Backfilled `true` only
  for accounts already on a non-default preset (red/purple/blue);
  gold and the retired `yellow` alias are treated as "never
  customized." Until customized (logged-out visitors included, since
  they never touch this flag at all), the `<html data-accent>` value
  resolves per current `view`: red on `dashboard` (Gaming)/`tcg-home`/
  `college-entertainment`/`college-collectibles`/`college-tabletop`
  (the 5 College **home** views only, not their subpages), gold
  everywhere else. Once a user picks any swatch, that choice applies
  everywhere again, same as before this change. No CSS changes needed
  — the `html[data-accent="red"]` preset already existed in
  `index.css`.

  `AccountSettingsPage.jsx`'s `onAccentColorChange` prop is now dead
  (renamed to `_onAccentColorChange` locally to satisfy lint) — the
  swatch calls `setAccentColorExplicit` via `useApp()` instead. Left
  `App.jsx`'s wiring of that prop alone rather than touching it mid
  your Overview work; harmless to leave, safe to clean up whenever.

  Committed `4a06cd6`, pushed to `main`.

- 2026-08-30 — **Real in-app presence added; friends/guild roster sort
  online-first.** User explicitly chose to build genuine in-app
  presence rather than reuse Steam status as an "online" proxy, and
  scoped it to exactly two lists: the friends list and the guild
  member roster — NOT the friend-request lists.

  New: `src/lib/presence.js` — `subscribeToPresence(userId, onChange)`
  joins a shared Supabase Realtime Presence channel (`"lykodex-
  presence"`, keyed by `user_id`), tracks on subscribe, calls back
  with a live `Set<userId>` on sync/join/leave. `sortOnlineFirst(items,
  onlineUserIds, getUserId, getDisplayName)` is the shared sort (online
  alphabetical, then everyone else alphabetical) — used by both call
  sites despite their different row shapes (`f.friend_id`/`f.profile`
  vs `m.user_id`/`m.profile`).

  Wired into `AppContext.jsx` as `onlineUserIds` state + a
  userId-keyed effect (same pattern as `actingAsLykodex`), exposed via
  context. `FriendsPage.jsx`'s "Your friends" list and `GuildsPage.jsx`'s
  member roster both consume it via `useApp()` directly rather than
  new props — same deliberate "everything via props" exception already
  used in `AccountSettingsPage.jsx`. **Gotcha hit while wiring this**:
  the guild member roster (`members.map`) lives inside the `GuildDetail`
  sub-component in `GuildsPage.jsx`, not the top-level `GuildsPage`
  function — the hook has to go there, not in the outer component, or
  it's an unused variable in one scope and out-of-scope in the other.

  This is the first Realtime usage anywhere in the codebase (confirmed
  via grep before starting — zero existing `channel(`/`presenceState`
  usage). No existing convention to match; if a second Realtime feature
  gets built, revisit whether this should generalize.

  Committed `8844f1a`, pushed to `main`. Not yet load-tested with two
  real concurrent sessions — worth a manual check (open two browser
  profiles signed in as different accounts, confirm each shows the
  other online) before relying on it.

- 2026-08-29 — **Mobile fully paused and pulled off `main`.** Following
  the earlier "hub-first, mobile paused" decision, the user asked to go
  further: actually remove the native Android/iOS/Capacitor projects
  from the day-to-day tree, not just stop building feature work on them.
  Before removing anything, the exact pre-removal state was snapshotted
  on branch `mobile-paused-2026-08-29` (pushed to origin) — fully
  recoverable from there regardless of what happens to `main` afterward.

  Removed from `main`: `android/`, `ios/`, `capacitor.config.json`,
  `.github/workflows/release-android.yml`. Removed from `package.json`:
  the `@capacitor/android`/`@capacitor/ios` dependencies, the
  `@capacitor/cli` devDependency, and the `cap:sync`/`cap:android`/
  `cap:ios` scripts — nothing in `src/` ever imported those two platform
  packages directly (confirmed via a repo-wide grep before removing), so
  there was nothing else to touch for them. `package-lock.json`
  regenerated via `npm install` (95 packages dropped, 0 vulnerabilities).

  **Deliberately NOT removed** — these are shared platform-detection
  code and packages still actively used by working desktop/web code
  paths, not mobile-only, and gutting them would risk breaking things
  that work fine today for no real benefit: `src/lib/platform.js`
  (`isPackagedApp()`/`isTauri()`/`isAndroid()`/`isMobileApp()` — the
  `isAndroid()`/`isMobileApp()` branches simply never evaluate true
  anymore with no native shell to run in, which is fine, not broken);
  `@capacitor/core`/`@capacitor/app`/`@capacitor/browser` (still
  imported by `oauthRedirect.js`, `LoginPage.jsx`'s native OAuth flow,
  `UpdateCheckMenuItem.jsx` — all degrade gracefully on web/desktop via
  Capacitor's own web fallback, confirmed earlier this session);
  components that render conditionally on `isAndroid()`/`isMobileApp()`
  (e.g. `AndroidUpdateBanner.jsx`) — left in place, simply dormant.

  Verified: `npx oxlint src` and `npm run build` both clean after the
  removal + `npm install`. **Not yet verified**: a live GitHub Actions
  push to confirm `release-android.yml`'s removal actually stops that
  workflow from triggering (check the Actions tab after the next push
  — there should be no new Android run).

  User's call on future reuse: the current single-app Capacitor setup
  (now dormant on the archive branch) is meant to be **preserved and
  possibly reused for parts** of the future per-College mobile apps,
  not treated as a throwaway prototype — don't assume it'll be rebuilt
  fully from scratch without checking first.

- 2026-08-29 — **"Act as Lykodex" — real system account + session-swap
  toggle (`e6462f6`).** A genuine account (`profiles.username =
  'Lykodex'`, real `auth.users` row, email `system@lykodex.internal`,
  no real password anyone knows) now owns all 5 official College guilds
  (`guilds.created_by`) — it's the actual "leader," not Joshua's personal
  account anymore. `profiles.lykodex_delegate_user_id` on that account
  names the one real account (Joshua's) allowed to act as it.

  This is an app-wide session swap, not a client-side pretend-toggle —
  the user explicitly chose that scope, and RLS needs a genuine
  `auth.uid()` to enforce anything anywhere, so there wasn't a lighter
  correct option. New `lykodex-session` service merged into
  `api/pricing.js` (not its own file — `/api` was already at Vercel's
  Hobby-plan 12-function ceiling) verifies the caller's access token
  names the registered delegate, then uses the `service_role` key's
  admin API to mint and hand back a real Lykodex session.
  `AppContext.jsx`'s `actAsLykodex`/`returnToMyAccount` cache the
  personal session's tokens first so flipping back is instant, not a
  re-login. Toggle lives in Account Settings (reached via `useApp()`
  directly there, not threaded through `App.jsx`'s props — a deliberate,
  isolated exception since Header.jsx/App.jsx were mid-edit when this
  landed and this is exclusive to one account anyway). Gated on a
  narrow `am_i_lykodex_delegate()` RPC purely for UI visibility — the
  real authorization boundary is the server-side check on every session
  request, independent of what the toggle shows.

  **Needs one new Vercel env var before it works end-to-end:
  `SUPABASE_SERVICE_ROLE_KEY`** (Supabase dashboard → Settings → API →
  the `service_role` secret, never the anon/publishable one) — not yet
  confirmed added. Same "treat it like a master password" warning as
  the Discord bot's own README for the same key.

  Also same session: `profiles.selected_colleges` gaining a College now
  auto-joins that College's official guild via a new trigger
  (`auto_join_default_college_guilds`, verified end-to-end in a
  rolled-back transaction) — never auto-removes membership when a
  College is later deselected, that stays a separate real decision.

- 2026-08-29 — **Stock style chart pattern (documented; partial in app).**
  Overhaul reference for time-series charts — spline area lines, gradient
  fills, dashed horizontal grid, title/subtitle + dot legend, dual-series
  (actual vs target). Named **`stock-style`** in `DESIGN_TOKENS.md`.
  Early instances: `PriceHistoryChart.jsx`, `FriendMasteryChart.jsx`
  (`lightweight-charts` AreaSeries). Extend those for new charts.

- 2026-08-29 — **Sliding action bar pattern (documented, not built).**
  Overhaul reference from JARVIS v0 Integrations ("YOUR ENTIRE STACK.
  CONNECTED.") — full-bleed horizontal marquee of bordered chips beneath
  a section headline. Named **`sliding-action-bar`** in `DESIGN_TOKENS.md`
  (anatomy, motion, Lykodex colors, CSS sketch). Reference:
  https://v0-jarvis-ruby.vercel.app/#metrics . Distinct from `blockbar`.

- 2026-08-29 — **Blockbar pattern (documented, not built).** Overhaul
  reference for segmented vertical-block status/history strips — metric
  row + eyebrow + block track + range labels. Named **`blockbar`** in
  `DESIGN_TOKENS.md` (anatomy, semantic colors, CSS sketch, use cases).
  Say "blockbar" when implementing across hub screens.

- 2026-08-29 — **Overview page renovation (in progress).** Command-center
  hero stage (`overview-command`): split copy + `CollegeMorphHero`, Barlow
  Condensed headline, rotating stat carousel with **categorical accents**
  per College (gold reserved for vault total), morph hero syncs to the
  active slide via `focusCollegeId`. Signed-out state shows Sign in /
  Create account CTAs; loading uses a neutral skeleton (not gold).
  "Right now" lane uses `overview-tile` wrappers with accent strips
  (sky / gold / rose). College grid driven from `COLLEGES` with per-college
  corner folds, hover borders, and stat colors. Touch:
  `OverviewPage.jsx`, `CollegeMorphHero.jsx`, `index.css` (`.overview-*`;
  responsive blocks at end of file). Not yet verified: light theme, live
  browser check this session.

- 2026-08-29 — **Strategic direction: hub-first, mobile paused; College
  renames (labels only).** All development focus is on the hub (web +
  desktop/Tauri) until it hits the quality bar Joshua wants. Capacitor
  iOS/Android work is paused — no new mobile feature work. The product
  name stays **Lykodex** for now; a future hub rebrand (Citadel, Hub,
  Nexus, Relay, or keep Lykodex) is **not decided** — do not rename the
  product to any of those.

  **Future mobile strategy (document only — do not build yet):** not one
  monolithic Lykodex mobile app. Instead, separate siloed apps per
  College (better on-the-go UX), same account/login across all apps,
  each flavoured for its College, data still flowing back to the hub.
  First mobile app likely TCG (later). Keep APIs/data model ready for
  external per-College apps to sync into the hub — no separate repos or
  sub-projects yet.

  **College user-facing renames (implemented 2026-08-29):**

  | Internal ID (`selected_colleges`, routes, DB) | New label | Future app name |
  |---|---|---|
  | `gaming` | Gaming | Lykodex Gaming |
  | `tcg` | TCG | Lykodex TCG |
  | `entertainment` | Library | Lykodex Library |
  | `collectibles` | Loot | Lykodex Loot |
  | `tabletop` | Wartable | Lykodex Wartable |

  **IDs stayed stable** — only `label` / display copy changed in
  `src/data/colleges.js`, nav, headers, overview tiles, auth hero
  cycler/constellation nodes, command palette sublabels, and college
  home page titles. Hash routes (`college-entertainment`, etc.), file
  names (`EntertainmentHomePage.jsx`, `lib/entertainment.js`), component
  names, and Supabase table/column names were **not** renamed.

- 2026-08-27 — Auth + setup walkthrough: login/signup is a split stage
  (glass form left, CollectionConstellationBackground as the right-hand
  hero; on phones the constellation sits behind the form). Sign in /
  Create account tabs, Discord/Twitch first, Google/Apple/Microsoft as
  "soon". Post-signup onboarding is two steps (Colleges, then optional
  Steam/Discord/Twitch linking) — Dashfeed toggles and the welcome
  splash are out of that path. Skip/Continue both land on Overview.
  `OnboardingWelcomeStep.jsx` is deleted; `onboardingStep` now starts at
  `"college-picker"`. `src/lib/auth.js` / `oauthRedirect.js` were not
  touched — the disable-if-not-enabled check still gates the buttons.
  All four gate surfaces (page, panel, popover, and the one-off
  signed-out block in `FriendsPage.jsx`) now share
  `.auth-form__submit` + `.auth-form__secondary`, so
  `dash-header__login-btn` / `linking-row__connect` are no longer used
  as gate buttons. The auth/onboarding phone rules had to move to the
  very end of `src/index.css` — see the flat-file `@media` cascade gotcha
  above; they were silently losing to their own later base rules.
  Verified live at desktop and 360px: tab toggle, signup confirm-password
  field, both onboarding steps, Skip/Continue to Overview. Lint + build
  clean. Not yet verified: a real signup round-trip through Supabase
  (needs credentials), and packaged-app OAuth wait state.

  **Cinematic pass (same day, on top of the above).** The hero caption
  is now the loud element: `.auth-hero__title` is `clamp(44px, 6.4vw,
  96px)` uppercase condensed at 700 / `line-height: 0.88` /
  `letter-spacing: -0.025em`, split into a solid line ("Five Colleges.")
  and a hollow one ("One vault.") via `.auth-hero__title-line--ghost`.
  Body copy stays 13px in a 34ch measure — the extreme scale contrast
  with nothing sized in between is the whole point, so don't "balance"
  those two later. Also added: an 80px `--border`-tinted square grid on
  `.auth-hero::before` (z-index 0, under the constellation, which moved
  to z-index 1 and the overlay to 2); a fine scanline on
  `.auth-page::after` / `.onboarding-shell::after`; the mono eyebrow
  tightened from 10.5px/0.12em to 11px/0.19em; and `HeroCycler` in
  `LoginPage.jsx`, a crossfading College name.

  Two brand decisions worth not re-litigating:
  - **Condensed face is hero-only.** New `--font-display-condensed`
    (Barlow Condensed, added to the existing Google Fonts `@import`, not
    a second one). Bricolage stays the display face for every other
    heading — the condensed face exists so one headline can hit that
    scale without leaking into ordinary UI. Radii were deliberately left
    alone; the reference this came from is `border-radius: 0` throughout
    and we are not copying that.
  - **The cycling word uses the categorical section accents, not gold.**
    Gold `--accent` is interactive-only per `DESIGN_TOKENS.md` and can't
    be display text, and gold-on-near-black is a weaker contrast than
    the reference's blue-on-navy anyway. So each College gets a hue:
    gaming→`--sky`, tcg→`--violet`, entertainment→`--rose`,
    collectibles→`--amber`, tabletop→`--lime`. **No canonical
    per-College colour mapping existed anywhere in the repo before
    this** — `data/colleges.js` and `CollegeIcon.jsx` carry no hue — so
    this is the first one. If a real mapping gets defined later, make
    these `.auth-hero__cycler-word--*` rules follow it rather than
    inventing a second scheme.

  The cycler renders all 5 words stacked in one `inline-grid` cell, so
  the box is always as wide as the longest label and the word can change
  length without shifting anything. Under `prefers-reduced-motion:
  reduce` it clears its interval and freezes on the first College (it
  listens for `change`, so it reacts live, not just at mount). Verified
  frozen for 12s under CDP `Emulation.setEmulatedMedia`, and cycling
  again once cleared. The scanline sits above the form at z-index 3 with
  `pointer-events: none` — `document.elementFromPoint` on every control
  (inputs, submit, OAuth buttons, tabs) returns the control itself, and
  typing/clicking were exercised live. Nothing global was added: no
  `body::before`, and `.auth-page` / `.onboarding-shell` don't exist on
  `#/overview`. Scoping note: the `@media` for the reduced-motion
  transition sits next to its base rule mid-file, which is safe because
  it's not a width override and nothing later redeclares it — the phone
  block at the end of the file was not touched.

  Not verified in this pass: light theme (`html[data-mode="light"]`) —
  the ghost stroke and scanline are token-driven but were only looked at
  in dark; the non-`-webkit-text-stroke` fallback path (guarded by
  `@supports`, but every engine tested supports the property, so the
  fallback branch was never actually rendered); and packaged-app
  (Capacitor/Tauri) rendering.

  **Composition pass (same day, on top of the cinematic pass).** Two
  things were fighting: the caption plate was an opaque rounded card
  pinned to the bottom of the hero, which buried Entertainment and
  Collectibles behind it while the headline said "Five Colleges."; and
  the field was sparse enough that the upper 60% read as empty black
  rather than deep space. Fixed together:
  - `NODE_POSITIONS` in `CollectionConstellationBackground.jsx` is no
    longer a generated centred pentagon — it's five explicit fractional
    points squashed into the upper ~55% of the hero (`y` 0.12–0.53), so
    all five sit clear of the caption. If the caption ever gets taller,
    re-check these; the lowest node centre lands ~75px above the top of
    the caption gradient at 1920×1080.
  - `.auth-hero__overlay` is now a full-bleed bottom gradient scrim
    (`--bg` fading to transparent over ~190px) instead of a bordered,
    shadowed, `backdrop-filter`-blurred card. The blur was deliberately
    dropped, not merely not-added: a blurred band over a full-size
    animated canvas is the classic Android WebView stutter.
  - The field is now a triangulated mesh. Particles are seeded on a
    **jittered grid** (not pure random — random left bald patches) from
    a fixed-seed `mulberry32`, so the composition is identical every
    load, which is what makes the `prefers-reduced-motion` single frame
    a deliberate layout rather than a lucky roll. Each particle carries
    a `depth` driving size, alpha and speed together, so the near layer
    drifts visibly faster than the far one — that differential *is* the
    parallax; there is no separate parallax transform.
  - Node spokes are drawn in each College's own categorical accent
    (same `--sky`/`--violet`/`--rose`/`--amber`/`--lime` mapping as the
    cycler, now also held on the `COLLEGES` array in the component as
    `cssVar`). No new hue was introduced.

  Performance shape matters more than the raw counts here. Counts:
  ~`(w*h)/8200` particles clamped to 40–150 (138 at a 1089×1038 hero),
  `LINK_DISTANCE` 118 with `MAX_EDGES_PER_PARTICLE` 3,
  `NODE_LINK_DISTANCE` 190 with `MAX_EDGES_PER_NODE` 6. The old O(n²)
  double loop is gone: particles are bucketed into a uniform spatial
  hash sized to the link radius and only checked against the 9
  surrounding cells, and particle links are accumulated into 4 alpha
  buckets so the whole mesh costs 4 `stroke()` calls per frame rather
  than one per segment. **Don't "simplify" that back into per-segment
  strokes** — it's the reason the count could go up at all. Measured
  ~82fps sustained on desktop; not profiled on a real Android device.

  The centre glow on `.auth-hero .constellation-bg__scrim` dropped from
  `--accent` 14% to 7% and moved to `50% 32%`; at the old strength it
  read as a smudge once the mesh was carrying the depth.

  Verified live at 1920×1080 in both Sign in and Create account modes:
  all five nodes visible and unoccluded, `elementFromPoint` still
  returns the real control for tabs/inputs/submit/OAuth, typing works,
  and the canvas is pixel-identical across 4 samples over 2.1s when
  the page is loaded under CDP `Emulation.setEmulatedMedia`
  `prefers-reduced-motion: reduce`. Note the component listens for
  `change` on the media query too, but **that live flip could not be
  verified** — `setEmulatedMedia` on an already-loaded page doesn't
  fire the `change` event in this Chromium, so only the on-load path is
  proven. The `@media (max-width: 860px)` rule hiding
  `.auth-hero__overlay` and the nodes on phones was left exactly as is
  (a decision on that is still pending); 360px was re-checked and is
  unchanged. Lint + build clean.
- 2026-08-27 — Reset to a single starting point: V0 chats archived, stalled
  `v0/runtime-error-resolution-baf343a0` branch deleted unmerged (Commander
  View work is gone — next UI pass is a fresh isolated V0 screen, not a
  port of that branch). `DESIGN_TOKENS.md` is what V0 should be given.
- 2026-08-26 — Finished the Tailwind integration properly (packages +
  vite.config.js + CSS all in one commit, `f07d642`) after the earlier
  accidental partial-commit broke CI. Confirmed working on both release
  builds.
- 2026-08-25/26 — Google OAuth: web-side code is complete and working;
  Google itself still needs enabling in Supabase's dashboard with a real
  Google Cloud OAuth Client ID/Secret (external step, not blocked on
  code). See gotchas above for the native-app flow that's already built.
- 2026-08-25/26 — Overview hero rebuilt twice: first from a particle/
  "constellation" point-morph system (abandoned — a handful of points
  can't draw a recognizable icon) to real vector icons
  (`CollegeIcon.jsx`), then restyled again to a glossy 3D-badge look
  matching a reference the user liked. If asked to touch the College
  icons again, this file is the one shared component behind nav
  tabs/pickers/hero/sign-in background — a change here is global.
- 2026-08-25/26 — Added rotating banners (`SlidingBanner.jsx`, reused by
  `SteamPresenceCard.jsx` and `GuildPulseCard.jsx`) and a TradingView-style
  friend Mastery Score chart (`FriendMasteryChart.jsx`, on the Friends
  page) using `lightweight-charts` (already in the project via
  `PriceHistoryChart.jsx` — same up/down color convention, reuse it).
