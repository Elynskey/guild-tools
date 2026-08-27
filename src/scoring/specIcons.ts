/**
 * '<Spec> <Class>' -> WoW icon filename (see public/assets/icons/).
 *
 * Exhaustive across every current class/spec combination, not just the 30 sample
 * raiders. All icon files (including the 9 specs not covered by the sample roster,
 * marked below) are present in assets/icons/, sourced from the standard WoW icon
 * CDN per README.md's existing asset-sourcing note. RaiderRow's <img onError> still
 * falls back to the questionmark icon as a safety net for any future unmapped spec.
 */
export const SPEC_ICON: Record<string, string> = {
  // Warrior
  'Protection Warrior': 'ability_warrior_defensivestance',
  'Fury Warrior': 'ability_warrior_innerrage',
  'Arms Warrior': 'ability_warrior_savageblow',
  // Death Knight
  'Blood Death Knight': 'spell_deathknight_bloodpresence',
  'Unholy Death Knight': 'spell_deathknight_unholypresence',
  'Frost Death Knight': 'spell_deathknight_frostpresence',
  // Paladin
  'Protection Paladin': 'ability_paladin_shieldofthetemplar',
  'Holy Paladin': 'spell_holy_holybolt',
  'Retribution Paladin': 'spell_holy_auraoflight',
  // Druid
  'Guardian Druid': 'ability_racial_bearform',
  'Restoration Druid': 'spell_nature_healingtouch',
  'Balance Druid': 'spell_nature_starfall',
  'Feral Druid': 'ability_druid_catform',
  // Priest
  'Holy Priest': 'spell_holy_guardianspirit',
  'Discipline Priest': 'spell_holy_powerwordshield',
  'Shadow Priest': 'spell_shadow_shadowwordpain',
  // Shaman
  'Restoration Shaman': 'spell_nature_magicimmunity',
  'Elemental Shaman': 'spell_nature_lightning',
  'Enhancement Shaman': 'spell_shaman_improvedstormstrike',
  // Monk
  'Mistweaver Monk': 'spell_monk_mistweaver_spec',
  'Windwalker Monk': 'spell_monk_windwalker_spec',
  'Brewmaster Monk': 'spell_monk_brewmaster_spec',
  // Mage
  'Frost Mage': 'spell_frost_frostbolt02',
  'Fire Mage': 'spell_fire_firebolt02',
  'Arcane Mage': 'spell_holy_magicalsentry',
  // Hunter
  'Beast Mastery Hunter': 'ability_hunter_bestialdiscipline',
  'Marksmanship Hunter': 'ability_hunter_focusedaim',
  'Survival Hunter': 'ability_hunter_camouflage',
  // Rogue
  'Subtlety Rogue': 'ability_stealth',
  'Assassination Rogue': 'ability_rogue_eviscerate',
  'Outlaw Rogue': 'ability_rogue_waylay',
  // Warlock
  'Destruction Warlock': 'spell_shadow_rainoffire',
  'Affliction Warlock': 'spell_shadow_deathcoil',
  'Demonology Warlock': 'spell_shadow_metamorphosis',
  // Evoker
  'Devastation Evoker': 'classicon_evoker',
  'Preservation Evoker': 'classicon_evoker_preservation',
  'Augmentation Evoker': 'classicon_evoker_augmentation',
  // Demon Hunter
  'Havoc Demon Hunter': 'ability_demonhunter_specdps',
  'Vengeance Demon Hunter': 'ability_demonhunter_spectank',
};

export const ICON_FALLBACK = 'inv_misc_questionmark';

export const specIconFile = (spec: string, cls: string): string => SPEC_ICON[`${spec} ${cls}`] ?? ICON_FALLBACK;

export const specIcon = (spec: string, cls: string): string => `./assets/icons/${specIconFile(spec, cls)}.jpg`;

export const specIconFallback = `./assets/icons/${ICON_FALLBACK}.jpg`;
