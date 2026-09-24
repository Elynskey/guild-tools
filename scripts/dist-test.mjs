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

// The test addon this build installs and reads (see electron/dataSources/lootLog.cjs addonIdentity) -- generated
// fresh from the real addon so the two stay in step.
run('npm', ['run', 'addon:test']);
run('npm', ['run', 'icons:build']);
run('npm', ['run', 'installer-art:build']);
run('npm', ['run', 'proxy-config']);
run('npm', ['run', 'build']);
// Quoted as part of the token itself (not just the array element) -- run() shells out
// on Windows (shell:true, needed to resolve npx.cmd), and an unquoted space/parens in
// -c.productName=Guild Tools (Test) gets split into separate argv entries by cmd.exe,
// which electron-builder then rejects as unknown arguments ("Tools", "(Test)").
//
// -c.nsis.artifactName, not the top-level -c.artifactName -- package.json's own
// build.nsis.artifactName is more specific and won silently over a top-level override,
// so the first version of this script produced a file named identically to the real
// installer (confirmed live -- same filename appeared in release/ after a real build
// had just put a different .exe there moments earlier).
run('npx', [
  'electron-builder',
  '--win',
  '-c.productName="Guild Tools (Test)"',
  // A different appId, or Windows treats this as the SAME program as the real app and installs over it (found 2026-09-23: the Test
  // installer replaced the real app's folder, shortcut and uninstall entry). The new appId gives it its own folder and uninstaller.
  '-c.appId=com.casualraiddays.guild-tools.test',
  '-c.nsis.artifactName=Guild-Tools-TEST-Setup-${version}.${ext}',
  // The generated test addon rides along as a real folder next to the app (not inside the asar) -- test builds only.
  '-c.extraResources.from=addon-test/GuildToolsLootTest',
  '-c.extraResources.to=addon-test/GuildToolsLootTest',
]);

console.log('\n[dist-test] Done -- installer is release/Guild-Tools-TEST-Setup-<version>.exe');
