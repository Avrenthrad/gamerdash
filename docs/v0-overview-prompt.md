Design a new Lykodex Overview screen. Do NOT import or boot the Lykodex GitHub repo — your preview cannot run this project's Vite/Tailwind setup and will throw `SyntaxError: Unexpected token '*'`.

Work only from this message. Recreate the screen as a self-contained React preview using the tokens and the current layout shell below. Keep the information architecture (what the page shows and in what order). Redesign the visual treatment. Use the CSS variables, not extra hardcoded colors. Gold/accent is for interactive elements only (buttons, active dots, badges) — never body text.

Aesthetic: vault-black / parchment-gold. Warm dark neutrals, not cool grays. Elevation from soft shadows and surface layering. Restrained glow, not heavy neon.

Fonts (Google Fonts): Bricolage Grotesque (headings), Hanken Grotesk (body), JetBrains Mono (eyebrows/labels).

Honest empty states only — never invent a fake trend or count. Sample numbers below are placeholders so the shell can render.

Page structure to keep (top → bottom):
1. Page title "Overview" + subtitle
2. College morph hero (icon/badge crossfading across the 5 Colleges)
3. Collection stat hero (rotating big number + unit + ticker of live activity)
4. "Right now" row: Steam presence, Guild pulse, Friends activity
5. College tiles: Gaming, TCG, Library, Loot, Wartable — each with a real count or honest empty copy

Colleges and badge colors: gaming `--sky`, tcg `--violet`, entertainment `--rose`, collectibles `--amber`, tabletop `--lime`.

Output a self-contained screen I can copy into Cursor (JSX + CSS). Do not convert this to Next.js. Do not add Tailwind Preflight that resets the tokens.

--- SAMPLE DATA (logged-in user, all 5 Colleges on) ---

- total collected: 486
- Gaming: 142 games (Steam linked)
- TCG: 310 cards
- Library: 18 tracked
- Loot: 12 on shelf
- Wartable: 4 campaigns & armies
- ticker: "Josh added Elden Ring to Gaming" / "Maya logged a TCG binder update" / "Ryn started a new Wartable campaign"
- Steam now: Elden Ring — playing
- Guild: Lykodex Founders · 3 online
- Friends: 2 friends in-game

--- TOKENS (put these on :root) ---

--bg: #0C0B09;
--surface: #17140F;
--surface-raised: #201C16;
--border: #2E2A22;
--text: #F2EEE3;
--text-muted: #948C79;
--text-tertiary: color-mix(in srgb, var(--text-muted) 65%, transparent);
--text-primary: var(--text);
--text-secondary: var(--text-muted);
--accent: #D4AF37;
--accent-deep: #9C7A24;
--accent-bright: #F2CC66;
--red: #D4AF37;
--red-deep: #9C7A24;
--red-bright: #F2CC66;
--red-highlight: #FCEABB;
--text-on-accent: #16130D;
--amber: #E8A33D;
--teal: #3FC1C9;
--violet: #9D8DF1;
--rose: #E8637D;
--sky: #5AA9E6;
--lime: #8FC33D;
--grad-red: linear-gradient(135deg, var(--red-highlight) 0%, var(--red) 45%, var(--red-deep) 100%);
--font-display: 'Bricolage Grotesque', sans-serif;
--font-body: 'Hanken Grotesk', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--radius-sm: 7px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 14px;
--radius-pill: 999px;
--shadow-sm: 0 1px 2px rgba(0,0,0,.45), 0 1px 1px rgba(0,0,0,.3);
--shadow-md: 0 6px 20px rgba(0,0,0,.4);
--shadow-lg: 0 16px 40px rgba(0,0,0,.45);
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
--duration-fast: 120ms;
--duration-base: 200ms;

--- CURRENT OVERVIEW SHELL (this is the live page, with fetches replaced by the sample data above so you can render it) ---

```jsx
export default function OverviewPage() {
  const colleges = [
    { id: "gaming", label: "Gaming", value: 142, unit: "games" },
    { id: "tcg", label: "TCG", value: 310, unit: "cards" },
    { id: "entertainment", label: "Library", value: 18, unit: "tracked" },
    { id: "collectibles", label: "Loot", value: 12, unit: "on your shelf" },
    { id: "tabletop", label: "Wartable", value: 4, unit: "campaigns & armies" },
  ];

  const slides = [
    { key: "total", label: "Your collection", value: 486, unit: "pieces collected across your Colleges" },
    { key: "gaming", label: "Gaming library", value: 142, unit: "games in your library" },
    { key: "tcg", label: "TCG collection", value: 310, unit: "cards collected" },
    { key: "entertainment", label: "Library", value: 18, unit: "movies, shows, anime & books tracked" },
    { key: "collectibles", label: "Loot", value: 12, unit: "items on your shelf" },
    { key: "tabletop", label: "Wartable", value: 4, unit: "campaigns & armies" },
  ];

  const ticker = [
    "Josh added Elden Ring to Gaming",
    "Maya logged a TCG binder update",
    "Ryn started a new tabletop campaign",
  ];

  const currentSlide = slides[0];

  return (
    <div className="overview-page">
      <div className="price-page__head">
        <h1 className="price-page__title">Overview</h1>
        <p className="price-page__subtitle">What's actually going on across your Colleges.</p>
      </div>

      {/* College morph hero: glossy badge + label, cycles gaming → tcg → entertainment → collectibles → tabletop */}
      <div className="college-morph-hero">
        <div className="college-morph-hero__mark">
          <span className="college-morph-hero__icon" data-college="gaming" />
          <span className="college-morph-hero__label">Gaming</span>
        </div>
      </div>

      <div className="overview-hero">
        <span className="overview-hero__eyebrow">{currentSlide.label}</span>
        <div className="overview-hero__value">
          <span className="overview-hero__aura" aria-hidden="true" />
          <span className="overview-hero__number">486</span>
          <span className="overview-hero__unit">{currentSlide.unit}</span>
        </div>
        <div className="hero-card__dots" role="tablist" aria-label="Collection stat">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={i === 0}
              className={`hero-card__dot${i === 0 ? " hero-card__dot--active" : ""}`}
            />
          ))}
        </div>
        <div className="overview-ticker">
          <div className="overview-ticker__track">
            {[...ticker, ...ticker].map((line, i) => (
              <span className="overview-ticker__item" key={i}>
                <span className="overview-ticker__dot" aria-hidden="true" />
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section>
        <p className="h-lane-title">Right now</p>
        <div className="h-lane overview-now">
          <article className="overview-now-card">
            <span className="overview-now-card__kicker">Steam</span>
            <strong>Elden Ring</strong>
            <span>Playing now</span>
          </article>
          <article className="overview-now-card">
            <span className="overview-now-card__kicker">Guild</span>
            <strong>Lykodex Founders</strong>
            <span>3 online</span>
          </article>
          <article className="overview-now-card">
            <span className="overview-now-card__kicker">Friends</span>
            <strong>2 friends in-game</strong>
            <span>See activity</span>
          </article>
        </div>
      </section>

      <section>
        <p className="h-lane-title">Colleges</p>
        <div className="h-lane overview-grid">
          {colleges.map((college) => (
            <button type="button" className="overview-card" key={college.id}>
              <span className="overview-card__icon" data-college={college.id} />
              <span className="overview-card__label">{college.label}</span>
              <span className="overview-card__value">{college.value}</span>
              <span className="overview-card__unit">{college.unit}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

--- CURRENT CSS FOR THIS PAGE (use as the starting visual language; you may restyle, but keep the token names) ---

```css
.overview-page { display: flex; flex-direction: column; gap: 20px; }
.price-page__head { margin-bottom: 4px; }
.price-page__title { font-family: var(--font-display); font-size: 24px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
.price-page__subtitle { font-size: 14px; color: var(--text-muted); margin: 0; }

.college-morph-hero {
  position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 320px; background: var(--bg); overflow: hidden; border-radius: var(--radius-xl);
}
.college-morph-hero__mark { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.college-morph-hero__label {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--text-secondary);
}

.overview-hero { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 20px; }
.overview-hero__eyebrow {
  font-family: var(--font-mono); font-size: 11.5px; font-weight: 500;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;
}
.overview-hero__value { position: relative; display: inline-flex; align-items: baseline; gap: 10px; }
.overview-hero__aura {
  position: absolute; left: -30px; top: 50%; width: 200px; height: 200px;
  transform: translateY(-50%);
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 38%, transparent), transparent 70%);
  filter: blur(24px); z-index: -1; pointer-events: none;
}
.overview-hero__number {
  font-family: var(--font-display); font-size: 64px; font-weight: 800;
  letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums;
  background: var(--grad-red); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.overview-hero__unit { font-size: 16px; color: var(--text-muted); font-weight: 500; }
.hero-card__dots { display: flex; gap: 6px; margin-top: 12px; }
.hero-card__dot { width: 6px; height: 6px; border-radius: 50%; padding: 0; border: none; background: var(--border); cursor: pointer; }
.hero-card__dot--active { background: var(--accent); }

.overview-ticker { position: relative; margin-top: 16px; padding: 10px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); overflow: hidden; }
.overview-ticker__track { display: flex; align-items: center; gap: 36px; width: max-content; }
.overview-ticker__item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); white-space: nowrap; }
.overview-ticker__dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }

.overview-now { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.overview-now-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
  padding: 20px; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--shadow-sm);
}
.overview-now-card__kicker {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-muted);
}
.overview-now-card strong { font-family: var(--font-display); color: var(--text); font-size: 16px; }
.overview-now-card span { font-size: 13px; color: var(--text-muted); }

.overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.overview-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl);
  padding: 20px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
  text-align: left; cursor: pointer; position: relative; overflow: hidden; box-shadow: var(--shadow-sm);
}
.overview-card::before {
  content: ""; position: absolute; top: 0; right: 0; width: 22px; height: 22px;
  background: var(--grad-red); clip-path: polygon(100% 0, 100% 100%, 0 0); opacity: 0.85;
}
.overview-card__label { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
.overview-card__value { font-family: var(--font-display); font-size: 36px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
.overview-card__unit { font-size: 12px; color: var(--text-muted); }

body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font-body); }
```

Render this shell first so I can see the current page, then propose a redesigned Overview that still shows the same content. Desktop first, then a tighter stacked/horizontal-lane treatment under 720px.
