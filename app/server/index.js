import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ApiError, RoomStore } from './store.js';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/catalogue.json', ['catalogue.json', 'application/json; charset=utf-8']],
  ['/combat-ui.js', ['combat-ui.js', 'text/javascript; charset=utf-8']],
  ['/battlefield.js', ['battlefield.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-layout.js', ['battlefield-layout.js', 'text/javascript; charset=utf-8']],
  ['/battlefield.css', ['battlefield.css', 'text/css; charset=utf-8']],
]);
for (const id of ["charmander", "bulbasaur", "squirtle", "grimer", "shellder", "gastly", "caterpie", "weedle", "pidgey", "sandshrew", "pikachu", "abra", "psyduck", "meowth", "machop", "slowpoke", "magikarp", "dratini", "mankey", "clefairy", "vulpix", "nidoran-m", "diglett", "growlithe", "magnemite", "exeggcute", "cubone", "koffing", "rhyhorn", "chansey", "kangaskhan", "staryu", "scyther", "jynx", "electabuzz", "tauros", "lapras", "porygon", "aerodactyl", "snorlax"]) staticFiles.set(`/pokemon-art/${id}.png`, [`pokemon-art/${id}.png`, 'image/png']);
for (const dex of [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 26, 28, 33, 34, 36, 38, 51, 53, 55, 57, 59, 64, 65, 67, 68, 80, 82, 89, 91, 93, 94, 103, 105, 110, 112, 121, 130, 148, 149]) staticFiles.set(`/pokemon-art/forms/${dex}.png`, [`pokemon-art/forms/${dex}.png`, 'image/png']);
const vendorFiles = new Map([
  ['/vendor/three.module.js', join(appDir, 'node_modules/three/build/three.module.js')],
  ['/vendor/three.core.js', join(appDir, 'node_modules/three/build/three.core.js')],
]);
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'JSON_REQUIRED', 'Send application/json.');
  if (Number(req.headers['content-length']) > 8192) throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'INVALID_JSON', 'Request must contain valid JSON.'); }
}
function credential(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
  if (!match) throw new ApiError(401, 'UNAUTHORIZED', 'A valid room credential is required.');
  return match[1];
}

export function createApplication({ store, dataDir = join(appDir, '.data'), publicDir = join(appDir, 'public'), catalogue, now, cleanupIntervalMs = 30_000 } = {}) {
  const rooms = store || new RoomStore({ dataDir, catalogue: catalogue || JSON.parse(readFileSync(join(appDir, 'content', 'catalogue.json'), 'utf8')), now });
  const server = createHttpServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      // The fixed public allowlist is deliberate: private files are never URL-resolved.
      const path = req.url.split('?')[0];
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
      if (req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new ApiError(403, 'ORIGIN_REJECTED', 'Cross-origin writes are unavailable.');
        if (path === '/api/rooms') return send(res, 201, rooms.create(await body(req)));
        const match = /^\/api\/rooms\/([A-Za-z2-9]{6})\/(join|actions)$/.exec(path);
        if (match) {
          if (match[2] === 'join') return send(res, 201, rooms.join(match[1], await body(req)));
          const token = credential(req);
          return send(res, 200, rooms.action(match[1], token, await body(req)));
        }
      }
      const viewMatch = /^\/api\/rooms\/([A-Za-z2-9]{6})$/.exec(path);
      if (req.method === 'GET' && viewMatch) return send(res, 200, rooms.view(viewMatch[1], credential(req)));
      if (req.method === 'GET' && vendorFiles.has(path)) {
        const data = readFileSync(vendorFiles.get(path));
        res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'});
        return res.end(data);
      }
      const asset = staticFiles.get(path);
      if (req.method === 'GET' && asset) {
        let data;
        try { data = readFileSync(join(publicDir, asset[0])); }
        catch (error) { if (error.code === 'ENOENT') throw new ApiError(404, 'NOT_FOUND', 'File not found.'); throw error; }
        res.writeHead(200, { 'Content-Type': asset[1] });
        return res.end(data);
      }
      throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      if (error instanceof ApiError) return send(res, error.status, { error: error.message, code: error.code });
      console.error('Request failed; private error details suppressed.');
      send(res, 500, { error: 'The request could not be saved or completed.', code: 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  const timer = cleanupIntervalMs > 0 ? setInterval(() => {
    try { rooms.cleanup(); } catch { console.error('Room maintenance failed; private error details suppressed.'); }
  }, cleanupIntervalMs) : null;
  timer?.unref();
  server.on('close', () => clearInterval(timer));
  return { server, store: rooms };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const port = Number(process.env.PORT || 4173);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
    const { server } = createApplication();
    server.on('error', () => { console.error('Server could not listen. Check the configured port.'); process.exitCode = 1; server.close(); });
    server.listen(port, '127.0.0.1', () => console.log(`Foundation running at http://127.0.0.1:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  } catch { console.error('Startup failed. Check the catalogue and private saved-room data.'); process.exitCode = 1; }
}
