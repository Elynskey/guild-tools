import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const repo = path.resolve(__dirname, '..');

// A strict Content-Security-Policy, in the built page only (the dev server needs inline scripts for hot reload). No third-party
// hosts: the page talks to its own origin and shows portraits from Blizzard's image hosts over https.
const csp = (): Plugin => ({
  name: 'guild-tools-web-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta name="color-scheme" content="dark" />',
      `<meta name="color-scheme" content="dark" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'none'" />`,
    ),
});

/**
 * Local development only: mirrors what the server gateway does in production. /guild/api/* is forwarded to the Guild Tools proxy
 * with the proxy key added server-side (the browser never sees it), only the routes the page needs, each with its one method. The key comes
 * from the same generated config the desktop app is built with, so it never lands in this repo.
 */
// route -> the ONE method it may be called with. The roster route is a POST on the proxy (it triggers the cached fetch) but changes
// no guild data; everything else is a plain read.
const ROUTES: Record<string, 'GET' | 'POST'> = { '/roster': 'POST', '/loot-records': 'GET', '/loot-capture/heartbeats': 'GET', '/professions/cached': 'GET' };
function devGateway(): Plugin {
  return {
    name: 'guild-tools-web-dev-gateway',
    apply: 'serve',
    configureServer(server) {
      const configPath = path.join(repo, 'electron', 'dataSources', 'proxyConfig.generated.cjs');
      server.middlewares.use('/guild/api', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const send = (status: number, body: string) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(body);
        };
        const method = ROUTES[url.pathname];
        if (!method) return send(404, '{"error":"not found"}');
        if (req.method !== method) return send(405, '{"error":"method not allowed"}');
        if (!existsSync(configPath)) return send(500, '{"error":"no generated proxy config; run npm run proxy-config"}');
        try {
          const cfg = createRequire(path.join(repo, 'package.json'))(configPath) as { PROXY_BASE_URL?: string; PROXY_API_KEY?: string };
          const upstream = await fetch(`${cfg.PROXY_BASE_URL}${url.pathname}${url.search}`, { method, headers: { 'X-Proxy-Key': cfg.PROXY_API_KEY ?? '', 'X-Guild-Tools-Mode': 'prod' } });
          send(upstream.status, await upstream.text());
        } catch {
          send(502, '{"error":"upstream unreachable"}');
        }
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  base: '/guild/',
  plugins: [react(), csp(), devGateway()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5180, strictPort: true, fs: { allow: [repo] } },
  build: { outDir: path.join(repo, 'web-dist'), emptyOutDir: true, sourcemap: false, target: 'es2020' },
});
