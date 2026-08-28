// Per-boss "avoidable mechanic" reference for The Venomous Abyss + The Tidebound Grotto
// (Midnight Season 2, patch 12.1 "Curse of Ula'tek"). Sourced from community strategy
// guides (Wowhead boss cheat sheets, FrostyBoost's Nymrissa guide) on 2026-08-28, NOT
// independently verified against this guild's own combat logs -- ability names here are
// as written in those guides and are assumed to match Warcraft Logs' spell names exactly,
// but that assumption is unconfirmed. If a pull's mechanic-miss list looks wrong or empty
// for a boss that clearly has mechanics, the ability name here probably doesn't match the
// log's spell name and needs correcting against a real report.
//
// Scope, deliberately narrow: only mechanics where failing them shows up as "this player
// took damage from this named ability, without dying to it" -- a clean, generic signal
// from Warcraft Logs' DamageTaken table. NOT covered (would need debuff-stack tracking,
// interrupt-miss tracking, or positional/event data none of which this pass builds):
// soak-group mechanics (soaking is deliberate damage, not a miss), stack-building debuffs
// (Eternal Venom, Mark of Acid/Blood), dispel-stagger mechanics, and pure positioning
// calls with no attached damage instance (look-away, don't-stack).
//
// { ability: <Warcraft Logs spell name to match>, description: <officer-facing, one line> }
const BOSS_MECHANICS = {
  'Vashnik the Malignant': [
    { ability: 'Plague Froth', description: "Didn't spread -- stand still, let others dodge the wave." },
    { ability: 'Stygian Infection', description: "Void zone went off without moving away first." },
  ],
  "Nek'zali the Soulcoiler": [
    { ability: 'Essence Rend', description: "Stood in the puddle instead of moving to the edge." },
    { ability: 'Possession Barrage', description: "Didn't run from the boss before the spell landed." },
  ],
  'Entombed Sentinels': [
    { ability: 'Mark of Acid', description: 'Stood within 40 yards of the other boss and stacked the mark.' },
    { ability: 'Mark of Blood', description: 'Stood within 40 yards of the other boss and stacked the mark.' },
    { ability: 'Helical Toxins', description: 'Collided with another player instead of a matching-orb partner.' },
  ],
  'The Lost Explorers': [
    { ability: 'Shell Spin', description: "Stood in the frontal cone instead of dodging it." },
    { ability: 'Blink Nova', description: "Didn't move it away from the group before it went off." },
  ],
  Sszorak: [
    { ability: 'Ravage', description: "Faced the boss instead of pointing the cleave away from the group." },
    { ability: 'Mutilate', description: "Didn't point the cleave into the group soak." },
    { ability: 'Tempest', description: "Didn't dodge a tornado." },
    { ability: 'Raging Crosswinds', description: "Crosswind wasn't paired with a partner correctly." },
  ],
  'The Twin Fangs': [
    { ability: 'Stir the Depths', description: "Didn't dodge the wave." },
    { ability: 'Submerge', description: "Didn't avoid the laser beam." },
  ],
  'The Coiled Altar': [
    { ability: 'Gloombomb', description: "Didn't spread, or missed a clone." },
    { ability: 'Fragment of Malacrass', description: 'Stepped on too many ghosts at once.' },
  ],
  "Ula'tek": [
    { ability: 'Caustic Waves', description: "Didn't dodge the wave off the wings or tail." },
    { ability: 'Volatile Purge', description: "Wasn't spread 5 yards from other raiders." },
    { ability: 'Circling Prey', description: "Didn't evacuate the platform in time." },
  ],
  'Nymrissa Wavecaller': [
    { ability: 'Frost Barrage', description: 'Took a Frost Orb hit outside the assigned soak.' },
    { ability: 'Swirling Whirlpools', description: 'Grazed a whirlpool instead of finding the safe gap.' },
  ],
};

module.exports = { BOSS_MECHANICS };
