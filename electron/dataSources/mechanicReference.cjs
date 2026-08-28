// Per-boss "avoidable mechanic" reference for The Venomous Abyss + The Tidebound Grotto
// (Midnight Season 2, patch 12.1 "Curse of Ula'tek"). Ability names cross-checked against
// two sources: this guild's own real combat logs (see the "confirmed live" notes below)
// and Blizzard's own Game Data API journal-encounter endpoint (the in-game Adventure
// Guide/Dungeon Journal, fetched 2026-08-29) -- the latter is the authoritative spell-name
// source and already caught real bugs: a community guide's "Frost Barrage" isn't an actual
// spell name at all (the real one is "Frost Orb"), so that tag was never matching anything.
// Where a mechanic has both a "mark/cast" spell and a separate "actual hit" spell (e.g.
// Plague Froth -> Plague Wave, Stygian Infection -> Stygian Burst), both are tagged since
// it's not confirmed which one Warcraft Logs' DamageTaken table actually names. Where the
// Journal has no exact tactical description, the "fix" text still leans on community guides
// (Wowhead, FrostyBoost) for the practical how-to-avoid-it framing the Journal doesn't give.
//
// Scope, deliberately narrow: only mechanics where failing them shows up as "this player
// took damage from this named ability, without dying to it" -- a clean, generic signal
// from Warcraft Logs' DamageTaken table. NOT covered (would need debuff-stack tracking,
// interrupt-miss tracking, or positional/event data none of which this pass builds):
// soak-group mechanics (soaking is deliberate damage, not a miss), stack-building debuffs
// (Eternal Venom, Mark of Acid/Blood), dispel-stagger mechanics, interrupts, tank-only
// mechanics (a tank's job is to eat these; not a raid-wide miss), and pure positioning
// calls with no attached damage instance (look-away, don't-stack).
//
// { ability: <Warcraft Logs spell name to match>, what: <what the mechanic actually is>, fix: <the action that avoids it> }
const BOSS_MECHANICS = {
  'Vashnik the Malignant': [
    { ability: 'Plague Froth', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' },
    { ability: 'Plague Wave', what: 'A poison wave that hits anyone standing near another player.', fix: 'Spread out and stand still so others can dodge it.' },
    { ability: 'Stygian Infection', what: 'Marks a player with void zones that burst underneath them.', fix: 'Move away before it bursts.' },
    { ability: 'Stygian Burst', what: 'The void zone burst from Stygian Infection.', fix: 'Move away before it bursts.' },
  ],
  "Nek'zali the Soulcoiler": [
    { ability: 'Essence Rend', what: 'Marks a player and drops a harmful puddle at their feet once dispelled.', fix: 'Move to the edge of the room before calling for the dispel.' },
    { ability: 'Possession Barrage', what: 'A tank-targeted spell dealing damage based on the distance it travels.', fix: 'Run away from the boss until the spell lands.' },
  ],
  // "Toxic Droplets" confirmed via Blizzard's Journal API as a frontal spray from the
  // Breath of Ula'tek, not the "step on tiny slimes" mechanic a community guide
  // described under the same name -- trusting the official text over the guide here.
  'Entombed Sentinels': [
    { ability: 'Mark of Acid', what: 'A stacking debuff from standing too close to the other boss.', fix: 'Stay at least 40 yards from the other boss.' },
    { ability: 'Mark of Blood', what: 'A stacking debuff from standing too close to the other boss.', fix: 'Stay at least 40 yards from the other boss.' },
    { ability: 'Helical Toxins', what: 'Marks players with a number of orbs; colliding with the wrong player deals damage.', fix: 'Find the player whose orb count totals 4 with yours and collide with them, not anyone else.' },
    { ability: 'Toxic Droplets', what: 'The Breath of Ula’tek sprays venom droplets in a frontal cone.', fix: 'Avoid standing in front of it.' },
  ],
  // "Final Ascension" is confirmed real (Mor'zahi's energy-fill wipe) but is a
  // raid-wide DPS-race failure, not a personal dodge/positioning miss -- left
  // untagged on purpose, same reasoning as Sszorak's "Caustic Rain" below.
  // "Icebound Flames" and "Shredding Shards" are real but interrupt/tank mechanics,
  // out of this pass's scope (see the top-of-file scope note).
  'The Lost Explorers': [
    { ability: 'Shell Spin', what: 'A frontal cone attack that fires three shells.', fix: 'Stand outside the cone.' },
    { ability: 'Blink Nova', what: 'A teleport effect that damages anyone caught in it.', fix: "Move it away from the group before it goes off." },
    { ability: 'Throw Junk', what: "Soakable crates from Trader Gebbo that stack a bleed if you take too many at once.", fix: "Soak crates, but don't take more than a couple in a row." },
    { ability: 'Blast Wave', what: "Trader Gebbo's bomb, firing an expanding ring across the room when it explodes.", fix: 'Use a mushroom to bounce over the ring, or get clear before it hits.' },
    { ability: 'Elemental Explosion', what: 'A Fire or Frost circle exploding where it lands.', fix: 'Spread out, then walk into the puddle of the opposite element to clear it.' },
    { ability: 'Burning Flames', what: 'The lingering fire patch left by a Frostfire Volley circle.', fix: 'Walk into the opposite-element puddle (Frost) to clear it.' },
    { ability: 'Piercing Frost', what: 'The lingering frost patch left by a Frostfire Volley circle.', fix: 'Walk into the opposite-element puddle (Fire) to clear it.' },
    { ability: 'Mighty Thud', what: "First Mate Nama's slam -- damage splits evenly among whoever is standing at the impact point.", fix: 'Stack together on the impact point so the hit is shared, not solo.' },
  ],
  // Confirmed live: this fight logs BOTH "Mutilate" (the cast) and "Mutilated Gash"
  // (the actual hit) as separate named entries -- both tagged so either shows up.
  // Deliberately NOT tagged, confirmed real but not a personal-avoidable mechanic:
  // "Caustic Rain" is a hard-enrage cast (3rd time at 100 energy) that ends the pull
  // for everyone -- a raid timing failure, not a dodge/positioning one. "Corroding
  // Venom" is a stacking debuff from being hit, not itself a dodgeable source.
  // "Ula'tek's Presence" is confirmed a real spell (Journal API) but has no tactical
  // description anywhere -- likely a passive, not a mechanic to react to. "Fel Armor"
  // / "Spirit Link" don't match any known Sszorak spell at all -- likely WCL
  // attributing a death to an incidental buff/aura tick rather than the actual cause.
  // All left untagged rather than guessed.
  Sszorak: [
    { ability: 'Ravage', what: "A frontal cleave aimed wherever the tank is facing.", fix: 'Point it away from the raid.' },
    { ability: 'Mutilate', what: 'A frontal cleave meant to be soaked by the raid.', fix: 'Point it into the group soak.' },
    { ability: 'Mutilated Gash', what: 'A frontal cleave meant to be soaked by the raid.', fix: 'Point it into the group soak.' },
    { ability: 'Tempest', what: 'Tornadoes that sweep across the arena.', fix: 'Dodge them.' },
    { ability: 'Raging Crosswinds', what: 'A directional effect that has to be paired between two players.', fix: 'Point it at a partner whose crosswind is pointed back at you.' },
    { ability: 'Turbulent Gusts', what: 'The damage tick from an unpaired Raging Crosswinds.', fix: 'Point it at a partner whose crosswind is pointed back at you.' },
    { ability: 'Venomous Surge', what: 'Creates a venom cyst that later bursts into a Viscous Cyst.', fix: 'Place it away from the raid and make sure the wind triggers it on time.' },
    { ability: 'Viscous Cyst', what: 'A venom glob that bursts on contact or after 2 minutes, knocking players back and leaving a damaging pool.', fix: 'Stay clear of it, especially as it nears bursting.' },
    { ability: 'Caustic Claws', what: 'A follow-up burst from Venomous Surge on higher difficulties.', fix: 'Stay clear of the cyst area.' },
  ],
  // "Toxic Fumes" is confirmed real but raid-wide, unavoidable periodic damage (hits
  // everyone regardless of positioning) -- not a personal miss, left untagged on
  // purpose. Same for "Caustic Rain" (see Sszorak above -- an enrage/wipe cast, not
  // dodgeable). "Caustic Globule" (Blizzard's Journal API confirms this is the soak
  // target for Caustic Deluge) is a deliberate soak, also untagged.
  'The Twin Fangs': [
    { ability: 'Stir the Depths', what: 'Waves that sweep the room and add a stack of Eternal Venom.', fix: 'Dodge them.' },
    { ability: 'Submerge', what: 'A rotating laser beam during Phase 2.', fix: 'Watch the ring of orbs and avoid the path of the beam.' },
    { ability: 'Coiling Ichor', what: 'A debuff that drops a damaging pool wherever you are standing when it expires.', fix: 'Move to the edge of the room before the debuff runs out.' },
    { ability: 'Congealed Gore', what: 'The damaging pool left behind by Coiling Ichor or Sanguine Storm.', fix: 'Stay out of the pool.' },
    { ability: 'Vile Flood', what: 'A frontal torrent of toxin from Vexhul that also applies a stack of Eternal Venom.', fix: 'Get out of the frontal cone.' },
    { ability: 'Sanguine Storm', what: 'Globs of gore that Ithraz rains across the platform.', fix: 'Watch for where they land and move out of the way.' },
    { ability: 'Caustic Deluge', what: 'A salvo of globules that apply a stack of Eternal Venom if they hit you.', fix: 'Avoid getting hit by the globules.' },
    { ability: 'Concentrated Spittle', what: 'Vexhul pelts whoever is out of melee range with spittle.', fix: 'Stay in melee range of Vexhul.' },
    { ability: 'Clotted Bolt', what: 'Ithraz strikes whoever is out of melee range.', fix: 'Stay in melee range of Ithraz.' },
  ],
  // "Sever" (tank frontal aimed at orbs), "Guillotine" (a group soak), "Eternal
  // Nightfall"/"Spiritcackle" (interrupt mechanics), and "Corrupted Toxin" (a tank
  // stacking debuff) are all confirmed real via the Journal API but out of this
  // pass's scope -- see the top-of-file note.
  'The Coiled Altar': [
    { ability: 'Gloombomb', what: 'Spawns clones that all need to be collected.', fix: 'Spread out and make sure every clone gets collected.' },
    { ability: 'Fragment of Malacrass', what: 'Ghosts that deal AoE damage if too many are stepped on at once.', fix: "Step on ghosts one at a time, not in a cluster." },
    { ability: 'Venom Rupture', what: 'Coalesced Venom orbs explode into this when destroyed.', fix: 'Get clear of an orb before it ruptures.' },
    { ability: 'Despair', what: 'A Manifestation of Dread catching up to whoever it is fixated on.', fix: 'Look at it to freeze it in place; only look away to let it move toward the assigned point.' },
  ],
  // "Spectral Coils" (a group soak) and "Mother's Wrath" (damages everyone only if
  // no one stands in it -- an inverse soak) are confirmed real but excluded as
  // deliberate-soak mechanics, same policy as Caustic Globule/Guillotine above.
  "Ula'tek": [
    { ability: 'Caustic Waves', what: "Waves fired from the boss's wings and tail.", fix: 'Watch the wings and tail, and dodge them.' },
    { ability: 'Volatile Purge', what: 'Damages anyone standing too close to another player.', fix: 'Spread 5 yards apart.' },
    { ability: 'Circling Prey', what: 'Clears the entire platform of safe space.', fix: 'Evacuate the platform.' },
  ],
  // "Frost Orb" is the real spell name -- a community guide's "Frost Barrage" was
  // never a real ability (confirmed via Blizzard's Journal API), so that tag was
  // silently matching nothing. "Shatter" is the Heroic+ failure-to-soak explosion.
  'Nymrissa Wavecaller': [
    { ability: 'Frost Orb', what: 'Frost Orbs dropped by targeted players that need soaking.', fix: 'Soak your assigned orb(s) and get back to the boss.' },
    { ability: 'Shatter', what: 'An unsoaked Frost Orb detonating.', fix: 'Make sure every orb gets soaked before it expires.' },
    { ability: 'Swirling Whirlpools', what: 'Whirlpools that collapse inward from the perimeter.', fix: 'Find the safe gap and move through it.' },
  ],
};

module.exports = { BOSS_MECHANICS };
