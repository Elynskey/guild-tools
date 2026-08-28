/**
 * Core rotation priority per spec -- deliberately NOT specific talent picks, which
 * shift with every balance patch the way "best boss strategy" doesn't. Ability
 * priority order is far more durable (often survives multiple patches unchanged),
 * so this is the one layer of "what should I actually be doing" advice safe to bake
 * into the app as static text instead of a live lookup. Researched against current
 * guides (Icy Veins, Method) for Midnight Season 2, patch 12.1, 2026-08-29 --
 * still worth spot-checking after a major balance patch, since even priority order
 * can shift on big reworks.
 *
 * Keyed by "<Class> <Spec>", spaced the way Raider.IO and Warcraft Logs (after
 * warcraftlogs.cjs's spaceWclName normalization) both already return them.
 *
 * Covers all 40 current specs (confirmed against Blizzard's own
 * playable-specialization API, 2026-08-29 -- not assumed from memory, since
 * Midnight added a spec, Demon Hunter's Devourer, that didn't exist before), not
 * just the ones this roster happens to play right now. If a new spec is ever added
 * to the game, getRotationTip()'s null fallback in scoring.ts keeps the app working
 * without a crash -- it just falls back to the older generic phrasing until this
 * table is updated.
 */
export const ROTATION_PRIORITY: Record<string, string> = {
  'Death Knight Blood': 'Marrowrend to keep Bone Shield up, Heart Strike/Blood Boil as filler, Death Strike timed for real healing, not just Runic Power dump.',
  'Death Knight Frost': 'Obliterate and Frostscythe on cooldown to spend runes, weave in Remorseless Winter for AoE, dump Runic Power into Frost Strike.',
  'Death Knight Unholy': 'Festering Strike to build Lesser Ghoul stacks, Scourge Strike to spend them, Death Coil/Epidemic dumps Runic Power.',
  'Demon Hunter Havoc': "Build toward Eye Beam's demon form window, stack Initiative/Exergy before it, and prioritize Reaver's Glaive when it's up.",
  'Demon Hunter Vengeance': 'Keep Demon Spikes charges rolling continuously, Fracture as your core builder, Soul Cleave to spend.',
  'Demon Hunter Devourer': 'Spam consumes to 100 Fury, dump with Void Ray, finish with Eradicate -- repeat into Void Metamorphosis, then Void Ray on cooldown.',
  'Druid Feral': 'Keep Rake and Rip from ever falling off, dump combo points into Ferocious Bite or Primal Wrath, sync your three cooldowns together.',
  'Druid Guardian': "Mangle and Thrash on cooldown to build Rage, spend on Ironfur to mitigate and Maul/Raze for damage -- don't let Rage cap.",
  'Druid Balance': 'Keep Sunfire and Moonfire up, spend Astral Power before it caps -- Starsurge for single target, Starfall for AoE.',
  'Druid Restoration': 'Maintain Lifebloom on the priority target, Efflorescence under a stable group, spread Rejuvenation before damage lands and follow with Wild Growth.',
  'Evoker Devastation': 'Fire Breath and Eternity Surge on cooldown (ideally inside Dragonrage), chain Disintegrate to spend Essence between them.',
  'Evoker Preservation': 'Emerald Blossom as your main Essence spender, Living Flame as filler, Disintegrate for damage once healing is covered.',
  'Evoker Augmentation': 'Keep Ebon Might up above everything else, weave Prescience and empowered spells (Fire Breath, Upheaval, Eruption) while it is active.',
  'Hunter Beast Mastery': 'Bestial Wrath on cooldown, Barbed Shot before it caps charges or before Bestial Wrath comes up, Kill Command as the core spender.',
  'Hunter Marksmanship': 'Aimed Shot and Rapid Fire generate Precise Shots -- spend them on Arcane Shot before recasting either, Steady Shot fills the rest.',
  'Hunter Survival': 'Kill Command feeds Tip of the Spear -- spend two "tipped" abilities per stack, Wildfire Bomb on cooldown.',
  'Mage Frost': 'Frozen Orb and Glacial Spike on cooldown, spend Fingers of Frost procs on Ice Lance, rebuild with Flurry and Frostbolt.',
  'Mage Arcane': 'Build Arcane Charges and Clearcasting into Arcane Salvo, Arcane Barrage at 20 stacks, Prismatic Bolt whenever it procs.',
  'Mage Fire': 'Combustion and Meteor on cooldown, never overcap Fire Blast charges -- each one banked is a Hot Streak you never get back.',
  'Paladin Holy': "Holy Shock on cooldown for resource flow, spend Holy Power before it caps, don't let Infusion of Light procs go to waste.",
  'Paladin Retribution': 'Generators (Judgment, Blade of Justice, Hammer of Wrath) before spenders, Final Verdict or Divine Storm at 5 Holy Power -- never let it cap.',
  'Paladin Protection': "Shield of the Righteous to spend Holy Power, keep Consecration active, Shield Block/Ignore Pain before you're low, not after.",
  'Priest Holy': 'Holy Word: Serenity for priority single-target, keep Prayer of Mending bouncing, Flash Heal for spot healing without overcapping Benediction.',
  'Priest Shadow': "Keep Vampiric Touch and Shadow Word: Pain from falling off, don't let Insanity cap, spend it on Shadow Word: Death or Madness.",
  'Priest Discipline': 'Ramp Atonement onto the group before damage lands (Power Word: Shield, Power Word: Radiance), then heal through your own damage.',
  'Rogue Subtlety': 'Everything builds toward Shadow Dance -- Shadowstrike inside it, Backstab outside it, finishers at 6+ combo points led by Secret Technique.',
  'Rogue Assassination': 'Keep Garrote and Rupture up on anything that will live the duration, spend combo points on Envenom, sync Kingsbane with Deathmark.',
  'Rogue Outlaw': 'Sinister Strike below 6 combo points, Dispatch/Between the Eyes at 6+, Adrenaline Rush and Killing Spree on cooldown, Blade Flurry up with 2+ targets.',
  'Shaman Elemental': 'Cast the highest-priority thing available -- Lightning Bolt, Tempest, and Lava Burst on cooldown, Stormkeeper timed just before a burst window.',
  'Shaman Enhancement': 'Keep Crash Lightning, Stormstrike, and Lava Lash cycling aggressively -- that cadence is what feeds Maelstrom Weapon generation.',
  'Shaman Restoration': 'Keep Surging Totem active and Healing Stream Totem on cooldown, Unleash Life before Chain Heal or Healing Wave.',
  'Warlock Affliction': 'Keep Agony and Corruption up first, Dark Harvest on cooldown without overcapping Soul Shards, pool shards for Summon Darkglare.',
  'Warlock Destruction': 'Build Soul Shards with Conflagrate and Incinerate for Chaos Bolt, Soul Fire on cooldown, Shadowburn on Fiendish Cruelty procs.',
  'Warlock Demonology': 'Call Dreadstalkers on cooldown, Hand of Gul’dan to convert shards into Wild Imps, build toward Summon Demonic Tyrant.',
  'Warrior Arms': 'Keep Rend up, Colossus Smash on cooldown with Avatar synced to it, Mortal Strike and Overpower before Slam fills the rest.',
  'Warrior Fury': 'Rampage is your only real spender -- everything else is a generator feeding it. Keep it rolling on cooldown.',
  'Warrior Protection': "Shield Slam the instant it's up, Shield Block before capping charges, Ignore Pain to avoid overcapping Rage.",
  'Monk Mistweaver': 'Keep Renewing Mist coverage up without overcapping charges, Rising Sun Kick on cooldown, convert into Vivify when raid damage is out.',
  'Monk Brewmaster': 'Keg Smash on cooldown (Exploding Keg resets a charge), Purifying Brew as a spare charge when incoming damage is light.',
  'Monk Windwalker': 'Priority system, not a fixed rotation -- Fists of Fury feeds Spinning Crane Kick on 2+ targets, never delay a higher-priority ability for a lower one.',
};

export function getRotationTip(cls: string, spec: string): string | null {
  return ROTATION_PRIORITY[`${cls} ${spec}`] ?? null;
}
