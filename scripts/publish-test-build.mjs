// Publishes the latest Guild Tools TEST installer and the test addon to the VPS, on a page only the tailnet can open:
//   https://mct-vps.tailc6de61.ts.net/guild/test/
// Build first (`npm run dist:win:test`), then run this. It stages a small site in a temp folder, copies it to the server and runs
// web/deploy/test-downloads.sh there (backup first, nginx -t, automatic rollback, reload not restart).
//   node scripts/publish-test-build.mjs             build the site, upload it, publish it
//   node scripts/publish-test-build.mjs --dry-run   build the site in a temp folder and stop
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, copyFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const HOST = 'mct-vps';
const dryRun = process.argv.includes('--dry-run');

const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const installer = path.join(ROOT, 'release', `Guild-Tools-TEST-Setup-${version}.exe`);
const addonDir = path.join(ROOT, 'addon-test', 'GuildToolsLootTest');
if (!existsSync(installer)) throw new Error(`no Test installer for ${version}: run npm run dist:win:test first (${installer})`);
if (!existsSync(addonDir)) throw new Error('no generated test addon: run npm run addon:test first');

const addonToc = readFileSync(path.join(addonDir, 'GuildToolsLootTest.toc'), 'utf8');
const addonVersion = (addonToc.match(/^## Version:\s*(.+)$/m) ?? [])[1]?.trim() ?? 'unknown';

const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const stage = path.join(os.tmpdir(), `guild-test-publish-${Date.now()}`);
const site = path.join(stage, 'site');
mkdirSync(site, { recursive: true });

const installerName = path.basename(installer);
const addonZipName = `GuildToolsLootTest-${addonVersion}.zip`;
copyFileSync(installer, path.join(site, installerName));
// Windows' own bsdtar (System32), not whichever tar comes first on PATH: Git Bash's GNU tar cannot read a C: path. -a picks the zip format.
const winTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(existsSync(winTar) ? winTar : 'tar', ['-a', '-c', '-f', path.join(site, addonZipName), '-C', path.dirname(addonDir), 'GuildToolsLootTest'], { stdio: 'inherit' });

const installerInfo = { file: installerName, bytes: statSync(installer).size, sha256: await sha256(installer), builtAt: statSync(installer).mtime.toISOString() };
const zipPath = path.join(site, addonZipName);
const addonInfo = { file: addonZipName, bytes: statSync(zipPath).size, sha256: await sha256(zipPath), version: addonVersion };
writeFileSync(path.join(site, 'manifest.json'), JSON.stringify({ version, installer: installerInfo, addon: addonInfo }, null, 2));

const built = new Date(installerInfo.builtAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
writeFileSync(
  path.join(site, 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Guild Tools TEST downloads</title>
<style>
:root { --bg: #12100c; --card: #1c1813; --ink: #e8ddc4; --strong: #f6efdd; --muted: #a89b7c; --gold: #d4b358; --line: rgba(212,179,88,.2); --warn: #d99a2b; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 680px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-family: Cinzel, Georgia, serif; font-size: 22px; letter-spacing: .04em; color: var(--strong); margin: 0 0 4px; }
h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold); margin: 28px 0 8px; }
p { margin: 0 0 10px; }
.muted { color: var(--muted); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 10px 0; }
.card a.dl { display: inline-block; min-height: 44px; line-height: 44px; padding: 0 18px; border-radius: 8px; background: var(--gold); color: #1a1409; font-weight: 600; text-decoration: none; }
.card a.dl:focus-visible { outline: 3px solid var(--strong); outline-offset: 2px; }
code { font: 13px ui-monospace, Consolas, monospace; word-break: break-all; color: var(--muted); }
.warn { border-color: rgba(217,154,43,.6); color: var(--strong); }
.warn b { color: var(--warn); }
ol { padding-left: 20px; margin: 0; }
li { margin: 4px 0; }
</style>
</head>
<body>
<main>
<h1>Guild Tools TEST downloads</h1>
<p class="muted">Version ${esc(version)}, built ${esc(built)}. For Windows PCs on the tailnet.</p>

<div class="card warn"><b>Close the real Guild Tools app before a test raid.</b> Both apps read the same WoW chat log, and the real one can copy test wins into the live loot store. The Test app itself only writes to the test data.</div>

<h2>The Test app</h2>
<div class="card">
<p><a class="dl" href="${esc(installerInfo.file)}">Download the Test installer</a></p>
<p class="muted">${esc(installerInfo.file)}, ${mb(installerInfo.bytes)}</p>
<p>SHA-256 <code>${esc(installerInfo.sha256)}</code></p>
<p class="muted">Installs beside the real Guild Tools app as "Guild Tools (Test)", with its own folder and its own settings.</p>
</div>

<h2>The test addon</h2>
<div class="card">
<p><a class="dl" href="${esc(addonInfo.file)}">Download the test addon</a></p>
<p class="muted">Version ${esc(addonInfo.version)}, ${mb(addonInfo.bytes)}</p>
<p>SHA-256 <code>${esc(addonInfo.sha256)}</code></p>
<p class="muted">The Test app installs this itself. Use the zip only on a PC without the Test app: unzip it into <code>World of Warcraft\\_retail_\\Interface\\AddOns</code> and restart WoW.</p>
</div>

<h2>After installing</h2>
<div class="card"><ol>
<li>Start "Guild Tools (Test)" from the Start menu.</li>
<li>In game, type <code>/gtloottest help</code> for the test commands.</li>
<li>After loot, click the sync button (or type <code>/gtloottest sync</code>) so the app picks it up.</li>
</ol></div>
</main>
</body>
</html>
`,
);

console.log(`staged ${site}\n  installer ${installerName} ${mb(installerInfo.bytes)}\n  addon ${addonZipName} ${mb(addonInfo.bytes)}`);
if (dryRun) {
  console.log('dry run: stopped before uploading');
  process.exit(0);
}

const remote = '/tmp/guild-test';
const deployDir = path.join(ROOT, 'web', 'deploy');
// the server script must have Unix line endings whatever the working copy has
const scriptText = readFileSync(path.join(deployDir, 'test-downloads.sh'), 'utf8').replace(/\r\n/g, '\n');
writeFileSync(path.join(stage, 'test-downloads.sh'), scriptText);
const confText = readFileSync(path.join(deployDir, 'guild-tools-test-downloads.conf'), 'utf8').replace(/\r\n/g, '\n');
writeFileSync(path.join(stage, 'guild-tools-test-downloads.conf'), confText);

execFileSync('ssh', [HOST, `rm -rf ${remote} && mkdir -p ${remote}`], { stdio: 'inherit' });
execFileSync('scp', ['-r', site, path.join(stage, 'test-downloads.sh'), path.join(stage, 'guild-tools-test-downloads.conf'), `${HOST}:${remote}/`], { stdio: 'inherit' });
execFileSync('ssh', [HOST, `bash ${remote}/test-downloads.sh && rm -rf ${remote}`], { stdio: 'inherit' });
rmSync(stage, { recursive: true, force: true });
console.log('\npublished: https://mct-vps.tailc6de61.ts.net/guild/test/');
