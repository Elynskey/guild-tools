import type { RawLootRecord, RawTradeRecord } from '../raid/lootLogic';

/** Fabricated Need-roll wins for browser/dev-preview mode -- matches the shape lootLog.cjs returns from a real GuildToolsLoot SavedVariables file. Nothing outside useLootHistory.ts should import this directly. */
const NOW = Math.floor(Date.now() / 1000);
const NIGHT_AGO = NOW - 2 * 24 * 60 * 60;

export const sampleLootRecords: RawLootRecord[] = [
  { itemId: 219853, itemLink: '[Malignant Cuirass]', winner: 'Devkra', boss: 'Vashnik the Malignant', time: NIGHT_AGO },
  { itemId: 219860, itemLink: '[Soulcoiled Grasp]', winner: 'Anesidora', boss: "Nek'zali the Soulcoiler", time: NIGHT_AGO + 1_800 },
  { itemId: 219871, itemLink: '[Venomcarved Legguards]', winner: 'Grimsyl', boss: 'Entombed Sentinels', time: NIGHT_AGO + 3_600 },
  { itemId: 219871, itemLink: '[Venomcarved Legguards]', winner: 'Draventh', boss: 'Entombed Sentinels', time: NIGHT_AGO + 5_400 },
  { itemId: 219902, itemLink: '[Twinfang Signet]', winner: 'Kestrys', boss: 'The Twin Fangs', time: NOW - 60 * 60 },
];

export const sampleLootTrades: RawTradeRecord[] = [
  // Grimsyl's Venomcarved Legguards were traded to Draventh -- Draventh's own win above shows the "no match" case separately.
  { itemId: 219871, itemLink: '[Venomcarved Legguards]', from: 'Grimsyl', to: 'Sylnara', time: NIGHT_AGO + 3_600 + 300 },
];
