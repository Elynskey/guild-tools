# Updating Raider Status each season

All assets are now local — nothing on this page hot-links to Wix or the icon CDN.

## Every season (start of a new raid tier)

| What | Where |
| --- | --- |
| Item level gate | `ilvlThreshold` tweak (default 690 in the props JSON) |
| Raider.IO gate | `rioGate` tweak (default 1000) |
| Green / Yellow score cutoffs | `greenAt` / `yellowAt` tweaks (75 / 55) |
| Tier name + progression | header line "The Venomous Abyss · 3/8 Heroic", and the `3/8 Heroic` label on the kills strip |
| Kill shots + captions | `assets/site/kill-*.png` (drop in new screenshots, keep the filenames) and the three `<figcaption>` lines |
| Per-boss DPS thresholds | Lives in the pipeline, not this page — the page only shows "% of threshold" |

## Only when the expansion changes

- `assets/site/midnight-logo.avif` — swap the file, keep the name.
- `assets/site/hero-banner.jpg` — the guild site's hero art.

## Only when a class or spec is added

- Add one line to `SPEC_ICON` in the logic class: `'Spec Class': 'icon_file_name'`.
- Save that icon to `assets/icons/<icon_file_name>.jpg`.
- Unmapped specs fall back to `inv_misc_questionmark.jpg`, so nothing breaks.

## Monthly, not seasonal

- Gem/enchant reference table date in the freshness line ("enchant reference table refreshed 08/01").

## Never needs touching

- Roster, scores, deaths, trends — all come from the pipeline data.
- The scoring rules themselves (gates → weighted score → death cap) are structural.
