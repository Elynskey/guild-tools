// Launches the Vite dev server, waits for it to answer, then launches Electron
// pointing at it. Kept dependency-free (no concurrently/wait-on/cross-env) — just
// spawns and waits on the port directly.
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 5173;
const URL = `http://localhost:${PORT}/`;
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const vite = spawn(npxCmd, ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('Dev server did not start in time'));
          else setTimeout(check, 300);
        });
    };
    check();
  });
}

try {
  await waitForServer(URL);
} catch (err) {
  console.error(err.message);
  vite.kill();
  process.exit(1);
}

const electron = spawn(npxCmd, ['electron', 'electron/main.cjs'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_START_URL: URL },
});

electron.on('exit', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
