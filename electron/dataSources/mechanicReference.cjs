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
// { ability: <Warcraft Logs spell name to match>, what: <what the mechanic actually is>, fix: <the action that avoids it> }
const BOSS_MECHANICS = {
  'Vashnik the Malignant': [
    { ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' },
    { ability: 'Stygian Infection', what: 'Marks a player with void zones that burst underneath them.', fix: 'Move away before it bursts.' },
  ],
  "Nek'zali the Soulcoiler": [
    { ability: 'Essence Rend', what: 'Marks a player and drops a harmful puddle at their feet once dispelled.', fix: 'Move to the edge of the room before calling for the dispel.' },
    { ability: 'Possession Barrage', what: 'A tank-targeted spell that deals heavy damage on impact.', fix: 'Run away from the boss until the spell lands.' },
  ],
  'Entombed Sentinels': [
    { ability: 'Mark of Acid', what: 'A stacking debuff from standing too close to the other boss.', fix: 'Stay at least 40 yards from the other boss.' },
    { ability: 'Mark of Blood', what: 'A stacking debuff from standing too close to the other boss.', fix: 'Stay at least 40 yards from the other boss.' },
    { ability: 'Helical Toxins', what: 'Marks players with a number of orbs; colliding with the wrong player deals damage.', fix: 'Find the player whose orb count totals 4 with yours and collide with them, not anyone else.' },
  ],
  'The Lost Explorers': [
    { ability: 'Shell Spin', what: 'A frontal cone attack that fires three shells.', fix: 'Stand outside the cone.' },
    { ability: 'Blink Nova', what: 'A teleport effect that damages anyone caught in it.', fix: "Move it away from the group before it goes off." },
  ],
  Sszorak: [
    { ability: 'Ravage', what: "A frontal cleave aimed wherever the tank is facing.", fix: 'Point it away from the raid.' },
    { ability: 'Mutilate', what: 'A frontal cleave meant to be soaked by the raid.', fix: 'Point it into the group soak.' },
    { ability: 'Tempest', what: 'Tornadoes that sweep across the arena.', fix: 'Dodge them.' },
    { ability: 'Raging Crosswinds', what: 'A directional effect that has to be paired between two players.', fix: 'Point it at a partner whose crosswind is pointed back at you.' },
  ],
  'The Twin Fangs': [
    { ability: 'Stir the Depths', what: 'Waves that sweep the room and add a stack of Eternal Venom.', fix: 'Dodge them.' },
    { ability: 'Submerge', what: 'A rotating laser beam during Phase 2.', fix: 'Watch the ring of orbs and avoid the path of the beam.' },
  ],
  'The Coiled Altar': [
    { ability: 'Gloombomb', what: 'Spawns clones that all need to be collected.', fix: 'Spread out and make sure every clone gets collected.' },
    { ability: 'Fragment of Malacrass', what: 'Ghosts that deal AoE damage if too many are stepped on at once.', fix: "Step on ghosts one at a time, not in a cluster." },
  ],
  "Ula'tek": [
    { ability: 'Caustic Waves', what: "Waves fired from the boss's wings and tail.", fix: 'Watch the wings and tail, and dodge them.' },
    { ability: 'Volatile Purge', what: 'Damages anyone standing too close to another player.', fix: 'Spread 5 yards apart.' },
    { ability: 'Circling Prey', what: 'Clears the entire platform of safe space.', fix: 'Evacuate the platform.' },
  ],
  'Nymrissa Wavecaller': [
    { ability: 'Frost Barrage', what: 'Frost Orbs dropped by targeted players that need soaking.', fix: 'Soak your assigned orb(s) and get back to the boss.' },
    { ability: 'Swirling Whirlpools', what: 'Whirlpools that collapse inward from the perimeter.', fix: 'Find the safe gap and move through it.' },
  ],
};

module.exports = { BOSS_MECHANICS };
