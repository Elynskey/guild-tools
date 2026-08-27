# Casual Raid Days — raider performance & status tracking

Spec for a pipeline that pulls raid performance data automatically and produces a per-raider status (green/yellow/red/ineligible) plus feedback text. This doc is context for designing the dashboard in Claude Design — it is not implementation code.

## Guild context

- Guild: Casual Raid Days, The Scryers (US-Horde)
- Raid nights: Friday 9–11pm EST (Normal), Saturday 8–11pm EST (Heroic)
- Goal: AoTC every tier, casual philosophy, respects raiders' time
- Current expansion: Midnight, patch 12.1

## Data sources

| Source | What it provides | Access method |
|---|---|---|
| Warcraft Logs (GraphQL v2) | Per-fight DPS/HPS, deaths, parse percentiles, avoidable damage | OAuth client-credentials |
| Raider.IO | M+ score (current + highest-this-season), item level (current + highest-this-season) | Public REST, no auth |
| wowaudit | Gear/enchant/gem presence, per-character snapshot | Management API key |
| Wowhead | Per-spec BiS enchant/gem recommendations | Manual lookup, no API |
| Raidbots | Droptimizer/Top Gear sim reports (by report ID), static game data | Report-read API (no submit API) |

## Pull cadence

| Source | Cadence |
|---|---|
| Warcraft Logs | Every 15–20 min during raid windows (Fri/Sat); daily otherwise |
| wowaudit | Daily |
| Raider.IO | Saturday 7pm EST, 1hr before raid |
| Gems/enchants (Wowhead) | Monthly |
| Raidbots reports | Weekly or on-demand |

## Scoring model

### Layer 1 — Gates (pass/fail, no partial credit)

A raider who fails either gate is **not scored** — shown as ineligible, not as a low score.

- Raider.IO score ≥ 1000
- Item level ≥ [guild threshold], evaluated as `max(currently equipped, highest equipped this season)` — protects raiders who've swapped specs or gear sets this season

### Layer 2 — Weighted score (raiders who cleared both gates)

| Metric | Definition | Notes |
|---|---|---|
| DPS while alive | `damage done ÷ time alive` (not full fight duration) vs. per-boss/per-season threshold table | Custom calc — WCL's default DPS stat divides by full fight time including dead time, which double-penalizes deaths |
| HPS (healers only) | WCL percentile ranking, not raw HPS number | Normalizes for pulls where clean mechanic execution reduces healing need |
| Gear/enchant completeness | wowaudit presence check vs. monthly Wowhead reference table | Presence + correctness, not just "has an enchant" |
| Parse trend | Slope of parse percentile over the tier | Rewards improvement, not just current-state performance |

### Layer 3 — Death cap (overrides band regardless of score)

- 0 deaths: no cap, band determined by score
- 1 death: band capped at Yellow
- 2+ deaths: band capped at Red

This exists so a raider can't post a strong score while dying repeatedly and still show green — the cap makes death count visible as its own signal, not buried inside a weighted average.

## Status bands

- **Green** — clears both gates, hits thresholds, no death cap in effect
- **Yellow** — clears gates, short on one or two dimensions, or capped by exactly one death
- **Red** — clears gates but meaningfully below threshold, or capped by 2+ deaths
- **Ineligible (gray)** — failed a gate; not scored; UI shows *which* gate failed (RIO vs. ilvl) since the fix differs

## Feedback generation

Two cycles, same underlying metrics, different windows:

- **Per-night** — generated right after each raid, that night's data only. Informal, immediate, catches a rough night early. Should read as "this one night," not a verdict.
- **Rolled-up** — weekly / tier-to-date. Trend-driven (parse trend, gear progression over time, death patterns across nights). This is the "real" status for officer decisions.

Generation approach: templated logic decides *what* gets said and which band applies (deterministic, auditable); an LLM turns the structured facts into readable prose (avoids robotic "DPS: 87% of threshold" text while keeping the underlying judgment rule-based).

Feedback structure per raider:
1. Status line — band, plus gate status if failed
2. What's working — 1–2 specifics from strongest metrics
3. What needs attention — 1–2 specifics from weakest metrics, phrased as the actual gap
4. One clear next action — tied to the single biggest lever, not a list of everything

## What's explicitly out of scope (not measurable from these sources)

- Punctuality for sign-ups, attendance (would need wowaudit's calendar/presence module specifically — different endpoint than roster/gear)
- Discord chatter during pulls, addon updates, attitude/respect — social/behavioral, not data-trackable
- Full item BiS (trinkets, weapons) — varies too much per-character to reduce to a static table; only presence/correctness of gems and enchants is tracked, not full itemization

## Dashboard mockup notes (from Imagine prototype)

- Roster grid: one card per raider, left-border color = band, band label as small pill
- Ineligible raiders are visually distinct (gray, muted) — not styled as "worst red," since they weren't scored at all
- Death-cap indicator (skull icon) shown on the card front, before click-through, so it's scannable across the whole roster at a glance
- Detail panel on click: full metric breakdown for scored raiders; for ineligible raiders, shows which gate failed and their actual RIO/ilvl numbers instead of a score
- Color system: green/yellow/red/gray mapped to CDS semantic tokens (`--bg-success`, `--bg-warning`, `--bg-danger`, neutral surface)
