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
  // "Final Ascension" is confirmed real (Mor'zahi's energy-fill wipe) but is a
  // raid-wide DPS-race failure, not a personal dodge/positioning miss -- left
  // untagged on purpose, same reasoning as Sszorak's "Caustic Rain" below.
  'The Lost Explorers': [
    { ability: 'Shell Spin', what: 'A frontal cone attack that fires three shells.', fix: 'Stand outside the cone.' },
    { ability: 'Blink Nova', what: 'A teleport effect that damages anyone caught in it.', fix: "Move it away from the group before it goes off." },
    { ability: 'Throw Junk', what: "Soakable crates from Trader Gebbo that stack a bleed if you take too many at once.", fix: "Soak crates, but don't take more than a couple in a row." },
    { ability: 'Blast Wave', what: "Trader Gebbo's bomb, firing an expanding ring across the room when it explodes.", fix: 'Use a mushroom to bounce over the ring, or get clear before it hits.' },
    { ability: 'Elemental Explosion', what: 'A Fire or Frost circle exploding where it lands.', fix: 'Spread out, then walk into the puddle of the opposite element to clear it.' },
  ],
  // Confirmed live: this fight logs BOTH "Mutilate" (the cast) and "Mutilated Gash"
  // (the actual hit) as separate named entries -- both tagged so either shows up.
  // Deliberately NOT tagged, confirmed real but not a personal-avoidable mechanic:
  // "Caustic Rain" is a hard-enrage cast (3rd time at 100 energy) that ends the pull
  // for everyone -- a raid timing failure, not a dodge/positioning one.
  // "Ula'tek's Presence" / "Fel Armor" / "Spirit Link" show up as death-cause
  // abilities in real logs but don't match any known Sszorak mechanic -- likely WCL
  // attributing the death to an incidental buff/aura tick rather than the actual
  // cause. Left untagged rather than guessed.
  Sszorak: [
    { ability: 'Ravage', what: "A frontal cleave aimed wherever the tank is facing.", fix: 'Point it away from the raid.' },
    { ability: 'Mutilate', what: 'A frontal cleave meant to be soaked by the raid.', fix: 'Point it into the group soak.' },
    { ability: 'Mutilated Gash', what: 'A frontal cleave meant to be soaked by the raid.', fix: 'Point it into the group soak.' },
    { ability: 'Tempest', what: 'Tornadoes that sweep across the arena.', fix: 'Dodge them.' },
    { ability: 'Raging Crosswinds', what: 'A directional effect that has to be paired between two players.', fix: 'Point it at a partner whose crosswind is pointed back at you.' },
    { ability: 'Venomous Surge', what: 'Creates a venom cyst that later bursts into a Viscous Cyst.', fix: 'Place it away from the raid and make sure the wind triggers it on time.' },
    { ability: 'Viscous Cyst', what: 'A venom glob that bursts on contact or after 2 minutes, knocking players back and leaving a damaging pool.', fix: 'Stay clear of it, especially as it nears bursting.' },
  ],
  // "Toxic Fumes" is confirmed real but raid-wide, unavoidable periodic damage (hits
  // everyone regardless of positioning) -- not a personal miss, left untagged on
  // purpose. Same for "Caustic Rain" (see Sszorak above -- an enrage/wipe cast, not
  // dodgeable). "Deadly Venom" and "Caustic Globule" (a deliberate soak) also
  // untagged -- no confident source for the former, soaking isn't a miss for the latter.
  'The Twin Fangs': [
    { ability: 'Stir the Depths', what: 'Waves that sweep the room and add a stack of Eternal Venom.', fix: 'Dodge them.' },
    { ability: 'Submerge', what: 'A rotating laser beam during Phase 2.', fix: 'Watch the ring of orbs and avoid the path of the beam.' },
    { ability: 'Coiling Ichor', what: 'A debuff that drops a damaging pool wherever you are standing when it expires.', fix: 'Move to the edge of the room before the debuff runs out.' },
    { ability: 'Vile Flood', what: 'A frontal torrent of toxin from Vexhul that also applies a stack of Eternal Venom.', fix: 'Get out of the frontal cone.' },
    { ability: 'Sanguine Storm', what: 'Globs of gore that Ithraz rains across the platform.', fix: 'Watch for where they land and move out of the way.' },
    { ability: 'Caustic Deluge', what: 'A salvo of globules that apply a stack of Eternal Venom if they hit you.', fix: 'Avoid getting hit by the globules.' },
    { ability: 'Concentrated Spittle', what: 'Vexhul pelts whoever is out of melee range with spittle.', fix: 'Stay in melee range of Vexhul.' },
    { ability: 'Clotted Bolt', what: 'Ithraz strikes whoever is out of melee range.', fix: 'Stay in melee range of Ithraz.' },
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
