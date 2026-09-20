// Runs a Lua check script with the repo root as the working directory. Uses LUA_EXE, then a lua on PATH,
// then the usual Windows install location -- the addon checks are optional tooling, not part of the app.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const candidates = [process.env.LUA_EXE, 'lua', path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Lua', 'bin', 'lua.exe')].filter(Boolean);
const exe = candidates.find((c) => c === 'lua' || existsSync(c));
const result = spawnSync(exe, process.argv.slice(2), { cwd: ROOT, stdio: 'inherit' });
if (result.error) {
  console.error(`Could not run Lua (${exe}). Install Lua or set LUA_EXE.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
