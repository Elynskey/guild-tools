# Guild Tools (Casual Raid Days)

## Current status

This started as a design handoff for one screen (Raider Status) and has since shipped as a full app: **React + Vite + TypeScript**, packaged as an **Electron desktop app** (`electron-builder`, Windows NSIS installer) for its primary distribution. Eleven screens now exist under `src/screens/`: Landing, Raider Status, Professions, Pull Feedback, Loot History, Season Loot Report, Mythic+, Settings, Raid Signups, Guildie of the Month, and Analytics. Real data (Warcraft Logs, Raider.IO, wowaudit, Blizzard, Discord) flows through a proxy server the Electron main process talks to over IPC (`electron/dataSources/`, `electron/main.cjs`); credentials never enter the renderer or the web bundle.

**It also runs as a plain website**, and this was verified directly (not assumed): `npm run build && npm run preview` serves a working app with zero console errors across every route. Screens backed by read-mostly data (Raider Status, Professions, Pull Feedback, Loot History, Loot Report, Mythic+) fall back to bundled sample data when there's no Electron IPC bridge (`src/data/rosterSource.ts` and siblings — `window.electronAPI` is checked, sample data used when absent). Screens needing officer actions or live Discord data (Settings, Raid Signups, GOTM, Analytics) show a clean "requires the desktop app" message instead of crashing.

**Mobile**: Raider Status was audited at a 390px viewport with Playwright and three real overflow bugs were found and fixed (not just the one the original spec below flagged) — see commits `7fac1c9` and `c36737d`. The header's tier/tabs cluster now wraps instead of cramming into one row; the role-tabs control bar and the ledger table both scroll horizontally within their own containers instead of blowing out the page. Desktop layout is unchanged (verified via screenshot diff). The other 10 screens have not had the same mobile pass yet.

**Not yet done — live data in the browser.** The sample-data fallback above is real but static; nothing in the web build talks to the proxy directly. That needs: a browser-side OAuth callback (the proxy's Discord/Battle.net exchange currently only knows the Electron loopback redirect `http://localhost:53136/callback`), a session-token auth model to replace the shared `X-Proxy-Key` (which can't ship in a public JS bundle — anyone could read it via view-source), and CORS on the proxy for the new web origin. Blocked on access to the proxy's own source (`server.cjs` and friends aren't tracked in this repo — they live only on the deploy target). Planned to run **Tailscale-only** (private to the guild's own devices), not on the public internet, which simplifies the redirect URI and skips public DNS/TLS entirely.

## About the Design Files

The files below (`Raider Status.dc.html`, `support.js`, `_ds/`) are the **original design references** the Raider Status screen was built from — a prototype showing intended look and behavior, kept here as the authoritative source for colors, spacing, and interaction states, not as something still to be ported. The real implementation is `src/screens/RaiderStatus/` (and the rest of `src/`), built against the same `_ds/` design system.

All roster data in the prototype below is **hardcoded sample data** (30 fabricated raiders using real officer names) — the same shape `src/data/sampleRoster.ts` uses for the web build's fallback. The real (Electron) pipeline is described in "Data Model" below.

## Fidelity

**High-fidelity**, and the shipped app follows it pixel-for-pixel where the two have been compared. Colors, typography, spacing, and interaction states below are final and come from the bound CRD Guild Design System.

## Screens / Views

There is **one screen**. Everything happens in place — no routing, no modals.

### Screen: Raider Status

Page background `--surface-page` (`#12100c`). Body font Alegreya Sans, `--text-body` (`#cfc9bb`). Content column `max-width: 1160px`, centered, `padding: 32px`. Page bottom padding `80px`.

#### 1. Sticky header

- `position: sticky; top: 0; z-index: 6`, `border-bottom: 1px solid var(--border-soft)`.
- Background: `background-color: rgba(18,16,12,.92)` + `backdrop-filter: blur(10px)`, with `assets/site/hero-banner.jpg` as a `cover` background image positioned `center 30%`, under a horizontal scrim: `linear-gradient(90deg, rgba(18,16,12,.97) 0%, rgba(18,16,12,.72) 45%, rgba(18,16,12,.86) 100%)`.
- Inner row: `max-width 1160px`, `padding: 14px 32px`, flex, `gap: 24px`, wraps.
- **Left lockup:** guild crest image (`assets/guild-emblem.png`, 42px wide, `drop-shadow(0 2px 8px rgba(0,0,0,.55))`), then a stacked pair:
  - eyebrow `CASUAL RAID DAYS · THE SCRYERS · EST. 2010` — 11px, uppercase, `letter-spacing .09em`, `--text-muted`
  - title `Raider Status` — Cinzel 600, 20px, `letter-spacing .06em`, `--parchment-100`, line-height 1.1
- **Right cluster** (flex, `gap: 20px`): Midnight expansion logo (`assets/site/midnight-logo.avif`, height 38px, `opacity .9`); a right-aligned stack of eyebrow `CURRENT TIER` over `The Venomous Abyss · 3/8 Heroic` (14px, the `3/8` in IBM Plex Mono, `--gold-300`); then the window Tabs control.
- **Window Tabs:** two tabs, `Rolled-up` (default) and `Last raid night`. Active tab is `--gold-300` with a 2px gold underline; inactive `--text-muted`.

#### 2. Status ribbon

- Top line: eyebrow-styled `Tier-to-date · 30 raiders · average 65/100` in `--gold-300`, left; data-freshness sentence right, 11px `--text-faint`: `Warcraft Logs tier-to-date, last pull 14 min ago · wowaudit daily, 6 hrs · Raider.IO Sat 7:00pm · enchant reference table refreshed 08/01`. `padding-bottom: 10px; border-bottom: 1px solid var(--border-hairline)`.
- **Distribution bar:** flex row, `height: 6px`, `gap: 2px`, `margin: 14px 0 12px`. One segment per band, width = share of roster, background = band color, `box-shadow: var(--inset-bevel)`. Tooltip per segment.
- **Legend / filter chips:** one button per band, `padding: 5px 12px`, `border: 1px solid var(--border-hairline)` (→ `--border-strong` when that band is the active filter), `border-radius: 3px`, transparent background, hover `border-color: var(--border-soft)`. Contents: 6px band-colored dot, count in IBM Plex Mono 14px, label in 11px uppercase `letter-spacing .09em` (`--text-muted`, → `--parchment-100` when active). Clicking toggles a band filter on the roster; clicking the active one clears it.
- **Two summary sentences**, `max-width: 840px`, 16px/1.5:
  - `Going well.` in Cinzel 15px `letter-spacing .06em` `--accent-verdant`, followed by generated prose.
  - `Stopping us.` same treatment in `--accent-ember`.
  - Then a third line, 14px `--text-muted`, listing unscored raiders and which gate each failed.

#### 3. Control bar

Flex row, `align-items: flex-end`, `gap: 16px`, wraps, `margin-bottom: 24px`:
- Role Tabs: `Full roster 30` / `Tanks 4` / `Healers 6` / `Damage 20` (count rendered as a small mono suffix).
- Spacer.
- Search input, `width: 240px`, placeholder `Find a raider`. Filters on name, class, spec, ilvl, RIO.
- Switch labeled `Needs support first`, **default ON** (sorts worst-first).

#### 4. Roster ledger — three sections (Tanks, Healers, Damage)

Sections are rendered in fixed order and omitted when empty. Each section: `margin-bottom: 40px`.

**Section head** (flex, `gap: 14px`, `margin-bottom: 16px`): Lucide icon 20px in `--gold-300` (`shield` / `heart-handshake` / `swords`), heading in Cinzel 600 22px `letter-spacing .06em` `--parchment-100`, count in IBM Plex Mono 14px `--text-muted`, then a flexible 1px divider using `--rule-gold`.

**Ledger card:** `.crd-card` (background `#1c1813`, `1px solid rgba(212,179,88,.16)`, `border-radius: 5px`, `--shadow-2` + `--inset-bevel`), `padding: 0`, `overflow: hidden`.

**Column grid** (identical on the header row and every data row):
```
grid-template-columns: 3px minmax(160px,1fr) 92px 122px 78px 58px 62px 104px;
gap: 12px; align-items: center; padding-right: 18px;
```
1. band spine (3px, stretches full row height, background = band color)
2. Raider
3. `DPS while alive` (or `HPS percentile` in the Healers section)
4. `Gems & enchants`
5. `Parse trend` (or `Night parse` in the last-night window)
6. `Deaths` (right-aligned)
7. `Score` (right-aligned)
8. `Band`

**Header row:** `background: var(--grad-header)` (`linear-gradient(180deg,#241f18,#15120e)`), `padding: 8px 18px 8px 0`, `border-bottom: 1px solid var(--border-hairline)`. Labels are 11px uppercase `letter-spacing .09em` `--text-muted`.

**Data row:** `border-top: 1px solid var(--border-hairline)`, `cursor: pointer`, hover `background: var(--surface-card-hover)` (`#241f18`) with `transition: background-color 140ms cubic-bezier(.16,1,.3,1)`. Ineligible rows render at `opacity: .72`.

Cell contents:
- **Raider:** 26px square spec icon (`1px solid var(--border-hairline)`, `border-radius: 2px`, `--shadow-1`), `gap: 10px`, then name in Cinzel 600 15px `letter-spacing .04em` `--parchment-100` over an 11px `--text-muted` subline, ellipsis-truncated: `Frost Mage · DPS · ilvl 712 · RIO 2740`.
- **Performance & Gear:** value in IBM Plex Mono 14px `--text-body` (`104%` for damage, `88th` for healer percentile, `92%` for gear), and under it a 3px track (`background: var(--surface-sunken)`) with a fill whose width is the metric's 0–100 score. Performance fill uses the band color; gear fill is `--accent-verdant` ≥95%, `--accent-ember` ≥80%, else `--accent-crimson`.
- **Trend:** mono 14px, `+4` / `-6` / `72nd`. `--accent-verdant` when non-negative (or percentile ≥50), else `--accent-ember`.
- **Deaths:** right-aligned mono 14px. Lucide `skull` icon (14px) shown only when deaths > 0. Color: 0 → `--text-faint`, 1 → `--accent-ember`, 2+ → `--accent-crimson`. Tooltip: `Death cap: band held at Yellow` / `…at Red`.
- **Score:** right-aligned IBM Plex Mono 20px in the band color. Ineligible rows show an em dash.
- **Band:** Badge pill with a leading dot — `Green` (success tone), `Yellow` (warning), `Red` (danger), `Ineligible` (neutral).

**Expanded detail (click a row):** the row stays in place and a panel opens directly beneath it, inside the same ledger card. `background: var(--surface-raised)` (`#181510`), `border-top: 1px solid var(--border-hairline)`, `box-shadow: var(--inset-well)`, `padding: 16px 24px 22px 22px`. Content column `max-width: 760px`, flex column `gap: 9px`:
1. eyebrow — `Rolled-Up · Tier-to-Date` or `Friday Night Only`
2. status line — 16px/1.5 `--parchment-100`
3. `Working.` label in `--gold-300` + sentence, 14px `--text-body`
4. `Attention.` label in `--gold-300` + sentence
5. next-step strip — `padding: 10px 14px`, `border: 1px solid var(--border-soft)`, `border-radius: 3px`, `background: var(--action-secondary)` (`rgba(212,179,88,.1)`), label `Next step.` in `--gold-300`, text `--parchment-100`
6. for ineligible raiders only: a mono row `Raider.IO 940 / gate 1000` and `Item level 689 / gate 690`, failing value in `--accent-crimson`
7. provenance line, 11px `--text-faint`

Only one row is expanded at a time. Clicking the open row closes it. Changing any filter or the window closes it.

#### 5. Empty state

When filters match nothing: `padding: 48px`, centered, `1px dashed var(--border-hairline)`, `border-radius: 5px`, `--text-muted`, copy `No raiders match that filter.`

#### 6. Kills strip + footer

- `margin-top: 48px`, `padding-top: 24px`, `border-top: 1px solid var(--border-hairline)`.
- Head row: eyebrow `This Tier's Kills` in `--gold-300`, `--rule-gold` divider, mono `3/8 Heroic` right.
- Three equal columns, `gap: 12px`. Each figure: image `height: 104px`, `object-fit: cover`, `1px solid var(--border-hairline)`, `border-radius: 3px`, `--shadow-2`; caption 11px `--text-muted` (`Sentinels · first Heroic kill`, `Vashnik · Saturday Heroic`, `Rotmire · two pulls, no deaths`).
- Footer banner image: `max-width: 560px`, centered, `margin-top: 28px`, `opacity: .4`, `mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)`.
- Fine print, `max-width: 720px`, 11px/1.5 `--text-faint`: "Gates first, then the weighted score, then the death cap. Attendance and anything about the person behind the toon stays off this board -- that is a conversation, not a number."

## Interactions & Behavior

| Interaction | Behavior |
| --- | --- |
| Window tabs | Switches the whole page between rolled-up (tier-to-date) and last-raid-night data. Closes any open row. Recomputes scores, bands, summary sentences, freshness line, and the trend column header. |
| Band legend chip | Toggles a single-band filter across all three sections. Active chip gets `--border-strong` and a colored count. |
| Role tabs | Filters to one role; sections for other roles disappear entirely. |
| Search | Case-insensitive substring match on name + subline. |
| "Needs support first" switch | ON (default): sort by band severity Red → Yellow → Ineligible → Green, then ascending score. OFF: descending score, then name. |
| Row click | Expands/collapses the feedback panel in place. Single-open accordion. |
| Hover | Rows warm to `--surface-card-hover`; chips gain `--border-soft`; per the design system, hover *lightens*, press *sinks* (`translateY(1px)`, outer shadow → `--inset-well`). |

No loading or error states are designed — the prototype is synchronous. In the real app, the ledger is the natural skeleton target (keep the header row, show 6 shimmer rows per section).

Responsive: the original design was not built for mobile — the ledger grid has fixed numeric columns and needs ~900px. **This has since been addressed in the shipped app** (see "Current status" above): the ledger card scrolls horizontally below that width rather than breaking page layout, which was the simpler of the two options this doc originally proposed (the other being a column-collapse into the expanded panel — not done, scrolling was sufficient).

Motion (from the design system): 90ms press, 140ms hover/color, 220ms dialog/toast, 380ms reveals; easing `cubic-bezier(.16,1,.3,1)`. No bounce, no spring, no scale-up entrances.

## State Management

Local UI state only:

| State | Type | Default |
| --- | --- | --- |
| `window` | `'rolled' \| 'night'` | `'rolled'` |
| `role` | `'all' \| 'tank' \| 'healer' \| 'dps'` | `'all'` |
| `band` | `'all' \| 'green' \| 'yellow' \| 'red' \| 'ineligible'` | `'all'` |
| `query` | string | `''` |
| `sortWorst` | boolean | `true` |
| `open` | raider name or null | `null` |

Configuration (exposed as tweaks in the prototype, should be server- or config-driven in production): `rioGate` (1000), `ilvlThreshold` (690), `greenAt` (75), `yellowAt` (55), `defaultWindow`.

Everything else is derived per render from the roster data + config. Nothing is persisted.

## Data Model

Per raider, per window:

```
name, role ('tank'|'healer'|'dps'), class, spec,
rioCurrent, rioHighestThisSeason,
ilvlEquipped, ilvlHighestThisSeason,
perf,            // damage-while-alive as % of the per-boss threshold; for healers, HPS percentile
gearCompletion,  // % of gem/enchant slots correct vs the monthly reference table
parseTrend,      // slope of parse percentile across the tier (points)
nightParse,      // percentile for the single-night window
deaths
```

### Scoring — implemented exactly as three layers

**Layer 1 — Gates (pass/fail, no partial credit).** `max(rioCurrent, rioHighestThisSeason) >= rioGate` and `max(ilvlEquipped, ilvlHighestThisSeason) >= ilvlThreshold`. Failing either → **Ineligible**, not scored. The UI must show *which* gate failed and the actual numbers, because the fix differs.

**Layer 2 — Weighted score (0–100)** for raiders past both gates:
- `perfScore` = healers: the HPS percentile directly. Others: `clamp((perf - 80) / 35 * 100, 0, 100)`.
- `gearScore` = `gearCompletion`.
- `trendScore` = rolled-up: `clamp(50 + parseTrend * 6, 0, 100)`. Night: `nightParse`.
- `score = round(perfScore * 0.5 + gearScore * 0.3 + trendScore * 0.2)`.
- Band: `>= greenAt` → Green, `>= yellowAt` → Yellow, else Red.

**Layer 3 — Death cap (overrides the band).** 0 deaths → no cap. 1 death → capped at Yellow. 2+ deaths → Red. The cap must stay visible as its own signal (the skull + count on the row, and stated first in the feedback), never averaged into the score.

### Feedback generation

The prototype uses deterministic templates keyed on the raider's strongest and weakest metric, with small variant pools selected by a name hash so 30 rows don't read identically. In production this is the "templated logic decides what gets said, LLM writes the prose" split: the rule engine picks the band, the strongest/weakest dimension, and the single next action; the LLM only phrases it.

**Voice rules (important — this failed twice before landing).** Short. Blunt. Numbers first. Officer notes, not paragraphs:
- `Yellow. One death holds it here -- the score was 71/100.`
- `Gems and enchants before Saturday's Heroic. Twenty minutes.`
- `Not scored. Raider.IO 940, gate is 1000.`

Use `--` as the dash (guild house style). No emoji. Never a list of everything — exactly one next action, tied to the biggest lever. Ineligible copy is framed as *no score*, never as a bad score. Labels are Title Case. Avoid: "elite", "sweaty", "parse requirement", any performance-review register. The guild is "we", the reader is "you", members are named.

Out of scope by design and must not be added: attendance, punctuality, sign-ups, Discord behavior, attitude, full BiS itemization.

## Design Tokens

Authoritative values — see `_ds/…/tokens/*.css` for the full set.

**Color**
```
--gold-300 #d4b358   --gold-400 #c0902f
--stone-900 #12100c (page)   --stone-800 #181510 (raised)
--surface-card #1c1813   --surface-card-hover #241f18   --surface-sunken #0a0907
--text-body #cfc9bb   --text-strong #f6efdd   --text-muted #948d7d   --text-faint #6a6459
--border-hairline rgba(212,179,88,.16)   --border-soft rgba(212,179,88,.28)   --border-strong rgba(212,179,88,.5)
--border-iron #3a362e   --iron-200 #9b978e (ineligible spine/dot)
Bands: Green --accent-verdant #5f9e4a · Yellow --accent-ember #c25b28 · Red --accent-crimson #a83232 · Ineligible neutral iron
Badge fills: success #8fc47c on rgba(95,158,74,.14) / border rgba(95,158,74,.5) — same pattern for warning (#e0885a / 194,91,40) and danger (#d67373 / 168,50,50)
```
No WoW class colors anywhere — band and rank carry color instead.

**Type** — Display **Cinzel** 600, `letter-spacing .06em`. UI/body **Alegreya Sans** 400/700. Numbers **IBM Plex Mono**. Scale 56/40/30/22 display · 20/17/15 title · 18/16/14 body · 13 label · 11 micro. Body line-height 1.5; display 1.08–1.25.

**Spacing** — 4px base: 4 8 12 16 20 24 32 40 48 64 80 96. Card padding 24, stack gap 16, inline gap 8, page gutter 32, content max 1160 (720 for reading columns).

**Radius** — 2 badges · 3 controls · 5 cards · 8 large panels. Pills only for tags, switch tracks, status dots.

**Elevation** — `--shadow-1…4` deep, low-spread, near-black. `--inset-bevel` on raised metal, `--inset-well` on pressed/typed-into surfaces. `--grad-header`, `--rule-gold`, `--grad-protect-*` as quoted above.

## Assets

All local in this bundle — nothing hot-links.

- `assets/guild-emblem.png`, `assets/guild-emblem-96.png` — the guild's own tabard emblem, the only brand mark. Ships with the design system.
- `assets/site/hero-banner.jpg`, `midnight-logo.avif`, `kill-sentinels.png`, `kill-vashnik.png`, `kill-rotmire.png`, `footer-banner.png` — the guild's own site images (from casualraiddaysthescryers.com).
- `assets/icons/*.jpg` — 30 WoW spec icons plus `inv_misc_questionmark.jpg` as the fallback, from the standard WoW icon CDN. Mapped `'<Spec> <Class>' → filename` in the logic class. These are Blizzard's art: fine for an internal guild tool, but do not redistribute or ship them in anything public-facing.
- UI icons are **Lucide v0.539.0** masked to `currentColor` (`shield`, `heart-handshake`, `swords`, `skull`, `users`, `scroll-text`, `database`, `check`). Never inline ad-hoc SVGs, never emoji.

## Files

- `Raider Status.dc.html` — the whole design: template markup + logic class (sample data, scoring, feedback generation) + tweak props JSON.
- `support.js` — the streaming-component runtime the prototype needs to open in a browser. Not part of the design.
- `_ds/` — CRD Guild Design System: `tokens/*.css` (authoritative values), `components/components.css` (`.crd-*` classes), `_ds_bundle.js` (React primitives: Crest, Icon, Button, Card, Badge, Tag, Input, Select, Checkbox, Radio, Switch, Tabs, Dialog, Toast, Tooltip).
- `assets/` — all images.
- `scoring.js` — the scoring + feedback engine as a plain ES module (no DOM, no framework): the three gate/score/death-cap layers, the feedback generator, roster roll-up, role sections, spec-icon map, and the 30-raider sample roster. Port this file close to verbatim; it is the auditable part of the product.
- `screenshots/` — five reference captures: top of page, the ledger, an expanded feedback row, the Ineligible band filter, and the kills strip.
- `SEASON-UPDATE.md` — what has to change at the start of each raid tier (gates, band cutoffs, tier name, kill shots) versus what never changes.

To view the original design prototype (reference only, not the real app): open `Raider Status.dc.html` in a browser from this folder, keeping the relative paths intact.

**To run the real app:**
- Desktop (Electron, full functionality): `npm install`, then `npm run electron:dev`.
- Browser (sample data, read-mostly screens only — see "Current status" above): `npm install`, `npm run dev` for a live-reloading dev server, or `npm run build && npm run preview` to check the production bundle.
