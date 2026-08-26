# Handoff notes — Claude Code ⇄ Cursor

This file is the shared source of truth between the two agents working on
Lykodex. There's no live link between us — no shared session, no direct
API — so this doc, plus commit messages/PR descriptions and code comments,
is how context actually crosses over. Keep it current: whoever picks up a
thread the other one dropped should be able to read this and know what's
going on without re-deriving it.

**Division of labor (as of 2026-08-26):** V0 generates UI designs, which
get imported into Cursor. Cursor owns wiring that UI up and general
feature build-out. Claude Code owns troubleshooting, testing/verification,
and some feature builds of its own (backend/Supabase work, native
platform plumbing, bug fixes) — delegated by the user per-task, not a
fixed split. If you're picking up a task the other agent started, check
the "In progress / recently touched" section below first.

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
- **The `Browser pane` local preview tool can't take real screenshots** in
  this environment (times out — "pane not displayed"). Structural
  verification (console errors, `read_page`/`get_page_text`, computed
  styles/bounding rects via the JS eval tool) works fine; for genuine
  pixel-level review, publish a small standalone HTML preview as an
  Artifact instead and have the user look at that.

## Open branches

- `v0/runtime-error-resolution-baf343a0` — V0's active branch, forked
  from `main` at `840e9eb`. Deliberately NOT merged into `main` (user's
  call, 2026-08-26) — this is meant to flow V0 → Cursor next, not get
  merged in directly. Contains real, substantive UI work: renames
  Overview to "Commander View" with a new landing layout
  (`.commander-landing`), adds a social analytics section (KPIs +
  charts), and a from-scratch redesign of `CollegeMorphHero` (orbit
  ring / topline status bar / rail indicator — structurally different
  from the glossy-badge hero currently on `main`, not just restyled —
  matching JSX changes went with it, not just CSS). Also has its own
  copies of the Tailwind-integration and this-file commits
  (content-identical to `main`'s `f07d642`/`afdabcd`, just different
  hashes — confirmed via diff, not a conflict). If picking this branch
  up: it was 2 ahead / 11 behind its own remote as of the last check
  (2026-08-26) due to a V0 sandbox mount corruption that got re-synced
  mid-session — re-verify that gap before assuming it's current.

## In progress / recently touched (most recent first)

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
