// Removes duplicate lost rolls (the same roll recorded by two officers) from a loot store. A DRY RUN unless --apply is passed.
//
//   dry run:  DATA_DIR=<proxy data dir> node cleanup-need-losses.cjs [--mode=prod|test]
//   apply:    DATA_DIR=<proxy data dir> node cleanup-need-losses.cjs [--mode=prod|test] --apply
//
// Run it where the store lives (the proxy server), from a folder that has dataSources/ beside it (the proxy's own folder), or
// from this repo (it falls back to electron/dataSources). Applying copies the store file to <file>.bak-<timestamp> first.
// How entries are judged is explained in dataSources/needLossCleanup.cjs; the plan is printed before anything changes.
const fs = require('node:fs');
const path = require('node:path');

const candidates = [path.join(process.cwd(), 'dataSources', 'lootRecordsStore.cjs'), path.join(__dirname, 'dataSources', 'lootRecordsStore.cjs'), path.join(__dirname, '..', 'electron', 'dataSources', 'lootRecordsStore.cjs')];
const storePath = candidates.find((p) => fs.existsSync(p));
if (!storePath) {
  console.error('Could not find dataSources/lootRecordsStore.cjs. Run this from the proxy folder or the repo.');
  process.exit(2);
}
const store = require(storePath);

const args = process.argv.slice(2);
const mode = (args.find((a) => a.startsWith('--mode=')) ?? '--mode=prod').split('=')[1] === 'test' ? 'test' : 'prod';
const apply = args.includes('--apply');

const before = store.load(mode);
const plan = store.cleanupNeedLosses(mode, { apply: false });
const when = (t) => new Date(t * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const shortName = (n) => String(n).split('#')[0];

console.log(`${mode} store: ${before.needLosses.length} lost roll(s); ${plan.remove.length} would be removed.`);
for (const g of plan.groups) {
  const entries = before.needLosses.filter((x) => x.itemId === g.itemId && x.name === g.name).sort((a, b) => a.time - b.time);
  console.log(`  ${shortName(g.name).padEnd(14)} ${String(g.item ?? g.itemId).slice(0, 30).padEnd(31)} entries ${g.entries}, copies won ${g.copies}, remove ${g.remove}  [${entries.map((e) => when(e.time)).join(', ')}]`);
}

if (!apply) {
  console.log(plan.remove.length ? '\nDry run: nothing was changed. Run again with --apply to remove them (a backup is made first).' : '\nNothing to do.');
  process.exit(0);
}
const result = store.cleanupNeedLosses(mode, { apply: true });
if (result.applied) console.log(`\nRemoved ${result.remove.length}. Backup: ${result.backup}`);
else console.log('\nNothing to remove; nothing changed.');
