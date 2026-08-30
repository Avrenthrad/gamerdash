# Design tokens

Reference for designing new Lykodex screens/components in isolation (V0,
Figma, or anywhere else) — without needing the full app checked out.
These are the real CSS custom properties from `src/index.css`'s `:root`
block; component CSS throughout the app reads them via `var(--name)`,
never a hardcoded literal.

**If you're V0 designing a screen from this file: design against these
values directly, in isolation. Don't try to import or boot the full
Lykodex repo — see HANDOFF.md for why that doesn't work in your preview
environment.**

## Aesthetic

"Vault-black / parchment-gold." Warm dark neutrals throughout — not cool
grays — so black and white both read as material (vault interior /
archival paper) rather than generic "dark mode gray." Gold accent is used
sparingly, for interactive elements only (buttons, active nav, badges) —
never for body text or description copy. Elevation comes from soft
ambient shadows and surface layering, not hard borders plus a glow on
every panel. Restrained glow, not heavy neon.

## Color (dark theme — the default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0C0B09` | Page background |
| `--surface` | `#17140F` | Card/panel background |
| `--surface-raised` | `#201C16` | Raised/nested surface |
| `--border` | `#2E2A22` | Hairline borders |
| `--text` | `#F2EEE3` | Primary text |
| `--text-muted` | `#948C79` | Secondary/muted text |
| `--text-tertiary` | `color-mix(in srgb, var(--text-muted) 65%, transparent)` | Tertiary/faint text |

Semantic aliases used throughout the stylesheet (prefer these names in
new component CSS): `--bg-base` → `--bg`, `--text-primary` → `--text`,
`--text-secondary` → `--text-muted`.

### Accent (gold, interactive-only)

| Token | Value |
|---|---|
| `--accent` | `#D4AF37` |
| `--accent-deep` | `#9C7A24` |
| `--accent-bright` | `#F2CC66` |
| `--text-on-accent` | `#16130D` (dark ink — the gold is light/mid-toned, needs dark text for contrast, not white) |

A user-selectable accent picker also swaps this whole slot to red
(`#E8283D`), purple (`#8B5CF6`), or blue (`#3B82F6`) — if a color needs
to react to that picker, reference `--accent`/`--accent-deep`/
`--accent-bright`, never the literal gold hex.

### Section accents (categorical — one per feature area)

Used for icons, small fills, and category-coded chips/badges. Never
introduce a new hue for a feature area already covered here.

| Token | Value | Area |
|---|---|---|
| `--amber` | `#E8A33D` | Achievements / trophies |
| `--teal` | `#3FC1C9` | Price / value |
| `--violet` | `#9D8DF1` | Progress |
| `--rose` | `#E8637D` | Library / alerts |
| `--sky` | `#5AA9E6` | Live service / calendar |
| `--lime` | `#8FC33D` | Friends |

Each has a matching gradient (`--grad-amber`, `--grad-teal`, etc.) for
panel top-bars/glows — a diagonal two-to-three-stop linear-gradient in
the same hue family, not a flat fill.

### Light theme

Swaps via `html[data-mode="light"]` — cream/white surfaces, not a
straight color inversion:

| Token | Value |
|---|---|
| `--bg` | `#F6F2E9` |
| `--surface` | `#FFFFFF` |
| `--surface-raised` | `#F3EEE1` |
| `--border` | `#E4DCC8` |
| `--text` | `#1A1712` |
| `--text-muted` | `#726A57` |

## Type

| Token | Value | Use |
|---|---|---|
| `--font-display` | `'Bricolage Grotesque', sans-serif` | Headings |
| `--font-body` | `'DM Sans', sans-serif` | Body copy, UI labels |
| `--font-label` | `var(--font-body)` | Section eyebrows, small caps labels |
| `--font-mono` | `'JetBrains Mono', monospace` | Codes, tabular data, mono UI only |

Bricolage Grotesque, DM Sans, and JetBrains Mono are Google Fonts — loaded via
`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Bricolage+Grotesque:wght@500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@500&display=swap')`.

## Shape & elevation

| Token | Value |
|---|---|
| `--radius-sm` | `7px` |
| `--radius-md` | `8px` |
| `--radius-lg` | `12px` |
| `--radius-xl` | `14px` |
| `--radius-pill` | `999px` |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.45), 0 1px 1px rgba(0,0,0,.3)` |
| `--shadow-md` | `0 6px 20px rgba(0,0,0,.4)` |
| `--shadow-lg` | `0 16px 40px rgba(0,0,0,.45)` |
| `--ring-focus` | `0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent)` |
| `--glow-accent-sm` | `0 4px 18px color-mix(in srgb, var(--accent) 16%, transparent)` |
| `--glow-accent-lg` | `0 0 46px color-mix(in srgb, var(--accent) 26%, transparent)` |

## Motion

| Token | Value |
|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--duration-fast` | `120ms` |
| `--duration-base` | `200ms` |

Respect `prefers-reduced-motion: reduce` — the app disables animation/
transitions globally under that media query; any generative/ambient
motion (particle fields, crossfades) should check it explicitly too.

## Blockbar (overhaul pattern)

**Name:** `blockbar` — use this term when requesting or implementing the
pattern across the hub overhaul.

**What it is:** A dense, dashboard-style status strip made of many thin
vertical segments (blocks) in a single horizontal row. Each block encodes
one unit of time or one discrete state in a sequence — e.g. one day in a
90-day uptime history, one week in a streak, one slot in a completion
grid. Read left → right as past → present.

**Reference layout** (from the overhaul mood board — adapt colors to
Lykodex tokens, do not copy the reference palette literally):

```
┌─────────────────────────────────────────────────────────────┐
│  EYEBROW (left)                          SUMMARY STAT (right) │
│  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌  │
│  start label                                    end label   │
└─────────────────────────────────────────────────────────────┘
```

Often paired above with a **metric row**: large display number, short
uppercase label, one-line description — separated by hairline vertical
dividers.

### Anatomy

| Part | Role |
|---|---|
| **Eyebrow** | Small caps label (`--font-label`), e.g. "Uptime last 90 days" |
| **Summary stat** | Aggregate on the right (e.g. `99.97%`) — semantic color for good/warn/bad |
| **Track** | Flex row of equal-width vertical blocks, small gap between segments |
| **Block** | Tall narrow rectangle (`border-radius: 1–2px`); height may encode severity |
| **Range labels** | Muted anchors under the track ends ("90 days" / "Today") |

### Block semantics (map to Lykodex — not reference cyan/neon)

| State | Suggested treatment |
|---|---|
| Good / complete / online | `--lime` or muted green mix on `--surface-raised` |
| Warning / partial / degraded | `--amber` |
| Bad / missed / offline / incident | `--rose` or `--red`; optional **taller block** for major events |
| Empty / future / no data | `--border` or very low-opacity `--text-muted` |

Prefer `color-mix(in srgb, <semantic> N%, transparent)` on dark surfaces
so blocks feel embedded, not neon.

### CSS sketch (class prefix: `blockbar`)

```css
.blockbar__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.blockbar__eyebrow {
  font-family: var(--font-label);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.blockbar__summary {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--lime); /* or --amber / --rose by state */
}

.blockbar__track {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 28px; /* tallest block sets the row */
}

.blockbar__block {
  flex: 1;
  min-width: 3px;
  max-width: 6px;
  height: 100%;
  border-radius: 2px;
  background: color-mix(in srgb, var(--lime) 55%, var(--surface-raised));
}

.blockbar__block--warn { /* amber, same height */ }
.blockbar__block--bad  { height: 100%; /* or 130% capped */ background: var(--rose); }
.blockbar__block--empty { background: var(--border); opacity: 0.5; }

.blockbar__range {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 6px;
}
```

### Where to use it (overhaul)

- Collection / vault health over time
- Streak or activity history (gaming, achievements)
- Sync / link status per connected account
- Price-watch or alert history
- Any "last N days" or "last N periods" summary that should read at a
  glance without a full chart

### Do / don't

- **Do** keep segment count fixed and label the time range explicitly.
- **Do** expose block meaning in a `title` tooltip or legend when color
  alone is ambiguous.
- **Don't** use `--accent` (gold) for block fills — gold stays
  interactive-only.
- **Don't** animate individual blocks on load unless
  `prefers-reduced-motion` is off and the motion adds real information.

Not implemented in the app yet — pattern name + spec only until wired
into specific screens.

## Sliding action bar (overhaul pattern)

**Name:** `sliding-action-bar` — use this term when requesting or
implementing the pattern across the hub overhaul.

**Reference:** JARVIS v0 integrations section — "YOUR ENTIRE STACK.
CONNECTED." on
[https://v0-jarvis-ruby.vercel.app/#metrics](https://v0-jarvis-ruby.vercel.app/#metrics)
(scroll to Integrations below the metrics blockbar). A full-bleed
horizontal strip of bordered chips that **slides continuously** (marquee)
beneath the section headline.

**What it is:** Not a static row of logos — a **motion surface** that
carries tappable or informational items across the viewport. Items are
uniform "action tiles" (small category eyebrow + primary label). Content
is duplicated end-to-end so the track can loop seamlessly. Reads as live,
connected infrastructure rather than a dead grid.

**Distinct from `blockbar`:** blockbar = vertical segments encoding
history/state; sliding-action-bar = horizontal, continuously moving strip
of discrete items.

### Anatomy

| Part | Role |
|---|---|
| **Section header** | Eyebrow + display headline above the bar (optional subcopy) |
| **Track** | `overflow: hidden` full-width container; hairline top/bottom border |
| **Marquee** | Inner flex row animated `translateX(0 → -50%)` on a loop |
| **Lane** | One copy of the item set (`shrink-0 flex gap-*`) — duplicate for seamless loop |
| **Item** | Bordered chip: mono category tag + display name; hover brightens border/text |
| **Footer CTA** | Optional centered link below second row ("+ 180 more…") |

### Motion

- Default: slow linear infinite scroll (~24–32s per full cycle on desktop).
- **Pause on hover** over the track (`animation-play-state: paused`) so
  users can read/click.
- **`prefers-reduced-motion`:** stop animation; show a wrapped static grid
  or single non-scrolling row with horizontal scroll instead.

### Lykodex adaptation (not the reference cyan palette)

| Reference | Lykodex |
|---|---|
| `#2196f3` hover border | `--sky` or `--accent` on hover only if item is clickable |
| `#1e1e1e` borders | `--border` |
| Muted chip text | `--text-muted` → `--text` on hover |
| Category tag | `--font-mono` at ~9–10px, `--text-tertiary` |
| Item label | `--font-display` or `--font-body` at ~15–18px |

Gold (`--accent`) only when the chip is an **action** (link, connect,
open). Passive logos/status tiles use categorical section colors.

### CSS sketch (class prefix: `sliding-action-bar`)

```css
@keyframes sliding-action-bar-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

.sliding-action-bar__track {
  overflow: hidden;
  border-block: 1px solid var(--border);
  padding-block: 12px;
}

.sliding-action-bar__marquee {
  display: flex;
  width: max-content;
  animation: sliding-action-bar-marquee 28s linear infinite;
}

.sliding-action-bar__track:hover .sliding-action-bar__marquee {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .sliding-action-bar__marquee {
    animation: none;
    flex-wrap: wrap;
    width: 100%;
    justify-content: center;
  }
}

.sliding-action-bar__lane {
  display: flex;
  gap: 10px;
  padding-inline: 6px;
  flex-shrink: 0;
}

.sliding-action-bar__item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  white-space: nowrap;
  transition: border-color var(--duration-base) var(--ease-standard),
              background var(--duration-base) var(--ease-standard);
}

.sliding-action-bar__item:hover {
  border-color: color-mix(in srgb, var(--sky) 45%, var(--border));
  background: color-mix(in srgb, var(--sky) 6%, var(--surface));
}

.sliding-action-bar__tag {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.sliding-action-bar__label {
  font-family: var(--font-display);
  font-size: 17px;
  color: var(--text-muted);
}

.sliding-action-bar__item:hover .sliding-action-bar__label {
  color: var(--text);
}
```

### Markup sketch

```html
<div class="sliding-action-bar__track">
  <div class="sliding-action-bar__marquee" aria-hidden="false">
    <div class="sliding-action-bar__lane"><!-- items --></div>
    <div class="sliding-action-bar__lane" aria-hidden="true"><!-- duplicate --></div>
  </div>
</div>
```

### Where to use it (overhaul)

- Linked accounts / connectors (Steam, Discord, TCG marketplaces)
- College ecosystem partners or data sources
- Recent marketplace or price-comparison sources
- "What's in your vault" category strip on Overview
- Any "stack connected" / integrations story that should feel alive

### Do / don't

- **Do** duplicate the lane for seamless loops; never animate a single
  lane that visibly jumps back to start.
- **Do** make items keyboard-focusable when they navigate somewhere.
- **Don't** use for primary navigation — this is ambient / discoverable,
  not the main nav (cf. mobile tab bar).
- **Don't** pack paragraphs into chips; one tag + one short label max.

Not implemented in the app yet — pattern name + spec only until wired
into specific screens.

## Stock style (overhaul chart pattern)

**Name:** `stock-style` — use this term when requesting or implementing
time-series charts across the hub overhaul.

**What it is:** A financial-dashboard line chart on a dark surface:
smooth spline curves, **gradient-filled areas** under each series, subtle
line glow, dashed horizontal grid lines only, compact axis labels, and a
header block (title + subtitle) with a **dot legend** for multiple
series (e.g. actual vs target, price vs benchmark, mastery vs friend
average).

**Reference mood:** Revenue-trend style dashboard chart — primary series
in cool blue, comparison/benchmark series in green, values formatted as
currency or compact units (`$150k`, `1.2M`), months or dates along the
bottom.

**Existing partial implementation:** `PriceHistoryChart.jsx` and
`FriendMasteryChart.jsx` already use `lightweight-charts` `AreaSeries`
with filled areas and trend coloring — treat those as early stock-style
instances. The full overhaul spec below adds multi-series legends,
smoother presentation, and shared tokens so new charts match.

**Distinct from `blockbar`:** blockbar = discrete status segments; stock-style
= continuous time-series with interpolated curves.

### Anatomy

| Part | Role |
|---|---|
| **Header** | Title (`--font-display` or body semibold) + muted subtitle |
| **Legend** | Top-right: colored dot + short label per series |
| **Plot** | Dark transparent or `--surface` panel; no heavy border |
| **Grid** | Horizontal dashed lines only (`--border` at low opacity) |
| **Y-axis** | Left scale, compact labels (`$0k` … `$600k`) in `--text-muted` |
| **X-axis** | Bottom time labels (months, dates) in `--text-tertiary` |
| **Series** | 1–3 lines max; area gradient fade to transparent at baseline |
| **Crosshair** | Optional on full-size charts; disabled on sparkline variant |

### Visual rules

| Element | Lykodex treatment |
|---|---|
| Primary series | `--sky` line + `color-mix(in srgb, var(--sky) 35%, transparent)` fill |
| Benchmark / target | `--lime` line + matching soft fill (or `--violet` for progress targets) |
| Negative trend (single series) | `--rose` or existing price down red (`#E8283D` in `PriceHistoryChart`) |
| Positive trend (single series) | `--lime` or existing up green (`#22c55e`) |
| Line weight | 2px stroke; optional subtle glow via `filter: drop-shadow(...)` on SVG wrapper only |
| Curve | Smooth / spline interpolation — no sharp angle changes between points |
| Gold `--accent` | **Not** for series lines — gold stays interactive UI only |

### Variants

| Variant | Use |
|---|---|
| **Full** | Header, legend, axes, crosshair, ~200px+ height — modals, detail pages |
| **Sparkline** | No axes, no legend, ~48px height — table rows, cards at a glance (`compact` prop pattern in `PriceHistoryChart`) |
| **Dual** | Two series with legend — actual vs goal, you vs friend, price vs market avg |

### Implementation notes (`lightweight-charts`)

Prefer the library already in the bundle (`lightweight-charts`). Shared
defaults for new stock-style charts:

```js
layout: { background: { color: "transparent" }, textColor: "var(--text-muted)" },
grid: {
  vertLines: { visible: false },
  horzLines: { color: "color-mix(in srgb, var(--border) 80%, transparent)", style: 2 }, // dashed
},
```

`AreaSeries` with `topColor` / `bottomColor` gradient pair per series.
For multi-series dual charts, use two `AreaSeries` or `LineSeries` with
semi-transparent fills — keep fills subtle so overlaps remain readable.

Class prefix for surrounding chrome (not the canvas): `stock-style-chart`
— e.g. `stock-style-chart__head`, `stock-style-chart__legend`,
`stock-style-chart__plot`.

### Where to use it (overhaul)

- Mastery score history over time (extend `FriendMasteryChart`)
- Collection value / vault total trends
- Price watch history (extend `PriceHistoryChart` / `MtgPriceHistoryModal`)
- Backlog completion rate vs personal goal
- Any metric where **change over time** matters more than a single number

### Do / don't

- **Do** use real recorded data only — honest empty state when &lt; 2 points.
- **Do** format axes for human scan (k/M suffixes, relative dates).
- **Do** respect `prefers-reduced-motion` — no animated draw-on effects.
- **Don't** add chartjunk (3D, heavy borders, neon grid).
- **Don't** mix more than three series — split into another chart instead.

Pattern documented for overhaul; extend existing chart components rather
than introducing a second chart library.
