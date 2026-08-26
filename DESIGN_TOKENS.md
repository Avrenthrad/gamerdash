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
| `--font-body` | `'Hanken Grotesk', sans-serif` | Body copy |
| `--font-mono` | `'JetBrains Mono', monospace` | Eyebrows, labels, mono/tabular data |

Both are Google Fonts — loaded via
`@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap')`.

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
