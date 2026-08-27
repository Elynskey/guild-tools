# Casual Raid Days (CRD) — Design System

A design system for **Casual Raid Days**, a World of Warcraft guild on **The Scryers (Horde
Retaliation)**, **est. 2010**. Its vision, in the guild's own words: *"To establish a supportive
community of players that respects and values each member's contribution, while participating in
a variety of shared interests that support the wellbeing of our guild."*

CRD is friendly, mature and supportive; accepting of all races, classes, interests and gaming
styles; running weekly guild challenges, PvP, and both nostalgic and progressive raids. *"Casual",
but not without commitment* — and, as a beloved former Officer put it, *"We are the most
hard-core, casual guild."* Everything in this system exists to make new material look and sound
like it came from that guild.

## Sources given
| Source | What it was |
| --- | --- |
| **https://www.casualraiddaysthescryers.com** (Wix site) | The live guild site — read for IA, copy and voice. Pages read: Home, What We Offer, Guild Expectations, Guild Events. |
| `uploads/31d447_dc08acd556c14bf080aa9ddfac5a605b.avif` | The guild tabard emblem (also the site's og:image). Converted to `assets/guild-emblem.png` + `assets/guild-emblem-96.png`. The palette is sampled from it. |
| Company description (chat) | The vision statement and recruitment blurb, matching the site's "Our Vision" section. |

Not available: the site's HTML/CSS source (Wix-generated), font files, and downloadable image
binaries. Real image URLs are recorded in `assets/REMOTE-ASSETS.md` and referenced directly by
the website UI kit, so nothing was drawn or invented.

## Surfaces
1. **Guild website** (`ui_kits/website/`) — recreation of the public site: Home, What We Offer,
   Guild Expectations, Guild Events, Register.
2. **Members lounge** (`ui_kits/portal/`) — **extrapolation, not a recreation.** The real
   Members page is password-protected, so this kit shows what a signed-in members area for CRD's
   real activities (Heroic progression, alt raid, LFR, keys, brunch, legacy raids, Guildie of the
   Month) would look like in-brand. Treat it as a proposal.

## Real guild facts worth reusing
- **Raid week:** Heroic progression every **Saturday** (Officer Perseffonee), Alt raid every
  **Friday** (Officer Vadailla), Guild LFR every **Wednesday** (Officer Quixxie). Current tier:
  **The Venomous Abyss**, 3/8.
- **Recurring events:** Harima's "Sunday Funday Keys" and "Monday Mayhem Keys", Zalanto's
  "Adventurous Keys", Shortie's Shenanigans (delves), Hotchick's "Brunch" (farming & fishing),
  Legacy Raids, Contests & Silliness, Harima's novel *Fall of Light*.
- **Officers:** Perseffonee [GM], Vadailla [Co-GM], Harima, Hotchick, Quixxie, Shortie, Zalanto.
  Plus a long honorary/retired list, including a memorial page for Nenda.
- **Ranks:** Initiate → Member → Veteran Member → Emeritus Officer → Officer Banker → Chief
  Officer & Officers. Each rank carries bank access and a gold repair allowance (200 / 600 / 400 /
  1000).
- **Institutions:** Guildie of the Month (vote with Officer Shortie), Pay It Forward, 8 guild bank
  tabs, Discord, YouTube channel, Facebook group, PayPal donations, a Classic-era CRD guild.

---

## Content fundamentals

**Voice.** Two registers, both warm, and it matters which you're in.

*Policy register* (What We Offer, Guild Expectations, loot rules): careful, adult, plain, slightly
formal. Long sentences are fine. Bulleted expectations. "We reserve the right to amend the
governing policies of CRD as necessary to promote a friendly, mature, and supportive community
for all of our members."

*Celebration register* (guild news, event posts, Guildie of the Month): loud and delighted.
ALL-CAPS bursts, exclamation marks, direct address, and the guild's signature move — **acrostics
on a member's name**. "MAKE SOME NOISE FOR ADDY — OUR AUGUST GUILDIE OF THE MONTH!" Posts are
signed with the officer's name at the end (e.g. *Shortie*).

**We / you / he-she.** The guild is **we**; the reader is **you**; individual members are named
outright and often praised by name. The site uses "he/she" and "his/her" rather than "they" —
keep that if you're extending policy copy.

**Casing.** Page and section headings are **Title Case** ("What We Offer", "Pay It Forward",
"Removal of Members", "Our Recent Accomplishments"). Body copy is sentence case. ALL CAPS is a
deliberate excitement device in news posts, and is also used for emphasis in policy ("Rank is
awarded to the PERSON not the toon").

**Recurring phrases** (use them — they are the guild's fingerprint): *the health and progression
of the guild*; *the person behind the toon*; *positive contributor*; *mature, supportive and
respectful*; *pay it forward*; *"casual", but not without commitment*; *variety of interests*.
Note the guild's own quotation marks around *"casual"*, *"serious"*, *"alt"* — keep them.

**Punctuation habits.** Double hyphen `--` as a dash. Semicolons in lists of interests
("weekly guild challenges, PvP; and nostalgic and progressive raids"). Officer names are prefixed
with their title in event copy ("Officer Harima's Sunday Funday Keys").

**Emoji.** Not used on the site. Excitement is carried by capitals and exclamation marks instead.

**Numbers.** Progression as `3/8`, `2/8`; gold allowances as "600 gold"; dates as `11/08/26`;
"est. since 2010".

**Do say / don't say**
| Say | Don't say |
| --- | --- |
| "We are 'casual', but not without commitment." | "Semi-hardcore CE-focused roster." |
| "Rank is awarded to the PERSON not the toon." | "Rank is earned through performance metrics." |
| "Be polite, punctual and prepared for guild events." | "Attendance is mandatory. No excuses." |
| "MAKE SOME NOISE FOR ADDY — OUR AUGUST GUILDIE OF THE MONTH!" | "Congratulations to this month's top performer." |
| "Pay these gestures forward. Do not be a taker." | "Resource sharing is governed by guild policy." |

**Words we avoid:** elite, sweaty, no-lifer, meta-check, parse requirement, "unleash", any
swearing (the guild explicitly asks for none), vulgar/derogatory/religious/political commentary.
**Words that fit:** supportive, mature, respectful, contribution, health and progression, silliness,
shenanigans, brunch, funday, mayhem, guildie.

---

## Visual foundations

Sampled from the tabard emblem — **gold banner, dark glyph, bronze frame** — against the site's
dark fantasy hero art.

**Color.** One brand accent: guild gold (`--gold-400 #c0902f`), with `--gold-300` for text on
dark. Grounds are near-black warm stone (`--stone-900 #12100c` page, `#1c1813` card) — four
surface steps inside twelve points of lightness, so hierarchy comes from borders and shadow rather
than contrast jumps. Neutrals are warm-leaning iron greys, never blue-grey. Five muted accents
(verdant, azure, arcane, ember, crimson) carry rank/status meaning and stay desaturated so gold
wins. A `.crd-parchment` scope inverts to aged paper for policy text and print. WoW class colors
are **not** used — rank and state carry color instead.

**Type.** Display is **Cinzel** (600, +0.06em tracking) — roman capitals for the "Welcome to /
Casual Raid Days" lockup, page headings and card titles. UI and body are **Alegreya Sans**
(400/700). Numbers are **IBM Plex Mono**. Scale: 56 / 40 / 30 / 22 display, 20 / 17 / 15 titles,
18 / 16 / 14 body, 13 label, 11 micro. Body line-height 1.5; display 1.08–1.25.

**Spacing & layout.** 4px base scale (4 8 12 16 20 24 32 40 48 64 80 96). Card padding 24, stack
gap 16, inline gap 8, page gutter 32. Content maxes at 1160px (720px for reading columns). The
site's own pattern is preserved: a full-bleed hero banner with the crest and titles centred on
it, a horizontal nav bar directly beneath, then stacked Title-Case sections, and a wide
information-dense footer (Quick Links, Guild Officers, donations, Guildie of the Month).

**Corners.** Almost square: 2px badges, 3px controls, 5px cards, 8px for large panels. Pills only
for tags, switch tracks and status dots.

**Cards.** `--surface-card` face, 1px translucent-gold hairline border, `--shadow-2` plus a faint
top `--inset-bevel` — engraved metal, not paper. Header bands use `--grad-header` with a hairline
rule beneath. Feature cards add `crest` (a 2px fading gold rule on the top edge); one or two per
screen. No colored left borders.

**Shadows.** Deep, low-spread, near-black (`--shadow-1…4`) — lamplight in a stone hall, not soft
grey drop shadows. `--inset-bevel` (light) on raised metal, `--inset-well` (dark) on anything you
type into or press. `--glow-gold` marks live/featured.

**Borders.** Translucent gold at three strengths — hairline (rules), soft (hover, secondary
buttons), strong (active, selected). Iron for form wells. `--rule-gold` is the fading gold divider
under section heads.

**Backgrounds & imagery.** The real site uses a dark fantasy illustration behind the hero, boss-kill
screenshots in a rotating "Our Recent Accomplishments" gallery, per-event thumbnails, and a
decorative footer banner. The website kit references those real images by URL
(`assets/REMOTE-ASSETS.md`); everything else is flat stone plus `--grad-vignette` and the
`--grad-protect-*` scrims that keep text legible over art. No textures, no noise, no bluish-purple
gradients. Imagery direction: warm, low-key, firelit — deep shadows, gold highlights, no cool blue
grading.

**Transparency & blur.** Two uses only: sticky headers (`rgba(18,16,12,.9)` + `--blur-panel`) and
the dialog scrim (`rgba(10,9,7,.78)` + blur). Cards are never translucent.

**Motion.** Weighted and settling: 90ms press, 140ms hover/tooltip/color, 220ms dialog and toast,
380ms reveals; easing `--ease-out cubic-bezier(.16,1,.3,1)`. Dialogs and toasts fade in and rise
10px. No bounce, no spring, no scale-up entrances. The one loop the brand does use is the site's
auto-advancing accomplishments gallery — a plain crossfade, not a carousel slide.

**States.** Hover *lightens* (gold one step lighter; secondary/ghost gain tint and a stronger
border; cards warm to `--surface-card-hover` with `--shadow-3`). Press *sinks*
(`translateY(1px)`, outer shadow swapped for `--inset-well`). Focus is a 2px pale-gold ring
(`--glow-focus`). Disabled is 0.42 opacity, shadows removed.

---

## Iconography

**Substituted set — please confirm.** The Wix site uses small bespoke PNG images (two class-icon
sprites either side of the nav, event thumbnails, a decorative footer banner) rather than an icon
system, and none are downloadable through this project. So UI icons use **Lucide** (v0.539.0) from
the `lucide-static` CDN, masked to `currentColor` by the `Icon` component.

- Always go through `<Icon name="…" />` — never inline an SVG, never use emoji or a unicode glyph
  as an icon.
- 13–16px inside text and controls; 18–22px as a card lead glyph.
- Muted by default, warming to gold on hover with their control.
- Vocabulary: `swords` (raid/PvP), `shield` (tank), `heart-handshake` (community), `calendar-days`
  (events), `users` (roster), `scroll-text` (expectations), `crown` (officer), `trophy` (Guildie of
  the Month), `bell`, `check`, `x`, `chevron-down`, `chevron-right`, `search`, `settings`, `info`,
  `message-circle` (Discord), `youtube`, `ellipsis`.
- **Emoji: never.** Unicode decoration: only the mid-dot `·` as a separator.

**Brand mark.** The tabard emblem (`assets/guild-emblem.png`) is the only mark, and it is the
guild's own. There is no wordmark artwork — where one is needed, "Casual Raid Days" / "CRD" is set
in Cinzel 900, +0.1em, in `--gold-300` (what `Crest` renders). Nothing was drawn, reconstructed or
approximated.

---

## Font substitutions (action needed)
The site is Wix-templated and no font files were provided. Nearest Google Fonts matches:

| Role | Using | Standing in for |
| --- | --- | --- |
| Display | **Cinzel** 400–900 | The roman-capital fantasy display used in the hero lockup |
| UI + body | **Alegreya Sans** 300–800 | A warm humanist sans for dense guild copy |
| Numbers | **IBM Plex Mono** 400/500 | Tabular figures |

Send the real faces and only `tokens/fonts.css` + `tokens/typography.css` change.

---

## Index

| Path | What's in it |
| --- | --- |
| `styles.css` | Entry point — `@import`s only. Consumers link this one file. |
| `tokens/fonts.css` | Google Fonts import (see substitutions) |
| `tokens/colors.css` | Base palette, semantic surfaces/text/borders, `.crd-parchment` scope |
| `tokens/typography.css` | Families, size scale, leading, tracking, weights |
| `tokens/spacing.css` | Space scale, radii, control heights, containers |
| `tokens/elevation.css` | Shadows, bevels, wells, gradients, protection scrims |
| `tokens/motion.css` | Durations, easings, standard control transition |
| `tokens/base.css` | Element resets, link colors, `.crd-eyebrow`, `.crd-rule` |
| `components/components.css` | All `.crd-*` component classes |
| `components/` | React primitives (below) |
| `guidelines/*.card.html` | 23 foundation specimen cards (Colors, Type, Spacing, Elevation, Motion, Brand) |
| `ui_kits/website/` | Guild website kit — see its README |
| `ui_kits/portal/` | Members lounge kit (extrapolation) — see its README |
| `templates/recruitment-post/` | Recruitment / raid-night post template |
| `assets/guild-emblem.png` | Guild tabard emblem (245×251) |
| `assets/guild-emblem-96.png` | 96px version for favicons and small lockups |
| `assets/REMOTE-ASSETS.md` | URLs of the real site images the kits reference |
| `thumbnail.html` | Homepage tile |
| `SKILL.md` | Agent-skill entry point |

### Components
Each has a `.jsx`, a `.d.ts` props contract, a `.prompt.md` usage note, and one `@dsCard` HTML
per directory.

- `components/brand/` — **Crest**
- `components/core/` — **Icon**, **Button**, **IconButton**, **Card**, **Badge**, **Tag**
- `components/forms/` — **Input**, **Select**, **Checkbox**, **Radio** (+ **RadioGroup**), **Switch**
- `components/navigation/` — **Tabs**
- `components/feedback/` — **Dialog**, **Toast**, **Tooltip**

**Intentional additions.** No source defined a component inventory (the site is Wix-templated), so
this is the standard primitive set sized to the guild's needs, plus two brand-specific pieces:
**Crest** (the only sanctioned way to render the mark) and **Icon** (a wrapper over the substituted
Lucide set, so the system can be re-pointed at real icon assets in one file). No Avatar component —
member initials are rendered inline, since no member portraits are available.

### Not built (deliberately)
No slide template (no deck supplied). No data-viz, email or illustration system. The site's
member-only areas (Members Lounge, Officer Quarters, Event Calendar detail, Raid Progression,
Harima's novel pages) were not readable, so they are not recreated.
