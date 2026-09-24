// Writes the guild crest as the real loot addon's icon: addon/GuildToolsLoot/crd-logo.tga (128x128, the format WoW loads without a
// converter). The addon's .toc points at it (## IconTexture) and its /gtloot window shows it. Same image the test addon uses.
//   node scripts/make-addon-icon.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crestTga } from './make-test-addon.mjs';

const OUT = path.resolve(import.meta.dirname, '..', 'addon', 'GuildToolsLoot', 'crd-logo.tga');
const { tga } = await crestTga();
await writeFile(OUT, tga);
console.log(`Wrote ${OUT} (${tga.length} bytes)`);
