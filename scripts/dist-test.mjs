// Builds "Guild Tools (Test)" -- the same codebase and the same shared proxy as a
// normal build, but every Raid Signups/GOTM request gets tagged test-mode (see
// electron/dataSources/proxyConfig.cjs / proxyClient.cjs), which the proxy routes to
// a completely separate data file and a staging Discord server (CRD-TEST) instead of
// the real one -- see server.cjs's X-Guild-Tools-Mode handling and dataSources/
// signupsStore.cjs & gotmStore.cjs. Everything else (Raider Status, Loot History,
// Professions, etc.) still shows real production data either way, since only those
// two features ever write anywhere isolation actually matters.
//
// -c.productName override (not a package.json change) gives this build its own Start
// Menu entry, taskbar icon label, and userData directory -- installs side by side
// with a real "Guild Tools" install on the same machine with zero collision. Run
// `npm run dist:win` normally for the real thing; this is strictly an additional,
// occasional build for testing/demos.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = { ...process.env, GUILD_TOOLS_TEST_MODE: '1' };

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env, shell: true });
}

run('npm', ['run', 'icons:build']);
run('npm', ['run', 'installer-art:build']);
run('npm', ['run', 'proxy-config']);
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--win', '-c.productName=Guild Tools (Test)', '-c.artifactName=Guild-Tools-TEST-Setup-${version}.${ext}']);

console.log('\n[dist-test] Done -- installer is release/Guild-Tools-TEST-Setup-<version>.exe');
