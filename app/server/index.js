import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ApiError, RoomStore } from './store.js';
import { playCardArtFiles } from '../public/play-card-face.js';
import { pokemonTypeIconPaths } from '../public/pokemon-types.js';
import { musicTracks, recordedMoves } from '../public/game-audio.js';
import { civilianProfiles, gymLeaderProfiles, partnerProfiles, roleProfiles } from '../public/trainer-profiles.js';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/catalogue.json', ['catalogue.json', 'application/json; charset=utf-8']],
  ['/combat-ui.js', ['combat-ui.js', 'text/javascript; charset=utf-8']],
  ['/play-card-face.js', ['play-card-face.js', 'text/javascript; charset=utf-8']],
  ['/pokemon-types.js', ['pokemon-types.js', 'text/javascript; charset=utf-8']],
  ['/battlefield.js', ['battlefield.js', 'text/javascript; charset=utf-8']],
  ['/trainer-profiles.js', ['trainer-profiles.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-effects.js', ['battlefield-effects.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-event-effects.js', ['battlefield-event-effects.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-move-effects.js', ['battlefield-move-effects.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-effect-recipes.js', ['battlefield-effect-recipes.js', 'text/javascript; charset=utf-8']],
  ['/game-audio.js', ['game-audio.js', 'text/javascript; charset=utf-8']],
  ['/pokemon-battle-motion.js', ['pokemon-battle-motion.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-terrain.js', ['battlefield-terrain.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-fire.js', ['battlefield-fire.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-coast.js', ['battlefield-coast.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-arcade.js', ['battlefield-arcade.js', 'text/javascript; charset=utf-8']],
  ['/fire-cascade.webp', ['fire-cascade.webp', 'image/webp']],
  ['/coastal-panorama.webp', ['coastal-panorama.webp', 'image/webp']],
  ['/coastal-horizon.webp', ['coastal-horizon.webp', 'image/webp']],
  ['/coastal-limestone.webp', ['coastal-limestone.webp', 'image/webp']],
  ['/coastal-masonry.webp', ['coastal-masonry.webp', 'image/webp']],
  ['/coastal-cliff.webp', ['coastal-cliff.webp', 'image/webp']],
  ['/coastal-ivy.webp', ['coastal-ivy.webp', 'image/webp']],
  ['/coastal-waterfall.webp', ['coastal-waterfall.webp', 'image/webp']],
  ['/coastal-stone.webp', ['coastal-stone.webp', 'image/webp']],
  ['/battlefield-draft.js', ['battlefield-draft.js', 'text/javascript; charset=utf-8']],
  ['/battlefield-layout.js', ['battlefield-layout.js', 'text/javascript; charset=utf-8']],
  ['/pokemon-models/forms.json', ['pokemon-models/forms.json', 'application/json; charset=utf-8']],
  ['/battlefield.css', ['battlefield.css', 'text/css; charset=utf-8']],
]);
for (const filename of playCardArtFiles) {
  const path = `play-card-art/${filename}`;
  staticFiles.set(`/${path}`, [path, filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png']);
}
for (const status of ['burn','confusion','flinch','paralysis','poison','sleep']) {
  const path = `battle-token-art/${status}.png`;
  staticFiles.set(`/${path}`, [path, 'image/png']);
}
for (const name of ['ice','flow','ring','leaf','laser','shock']) {
  const path = `battle-move-art/${name}.png`;
  staticFiles.set(`/${path}`, [path, 'image/png']);
}
for (const id of ["charmander", "bulbasaur", "squirtle", "grimer", "shellder", "gastly", "caterpie", "weedle", "pidgey", "sandshrew", "pikachu", "abra", "psyduck", "meowth", "machop", "slowpoke", "magikarp", "dratini", "mankey", "clefairy", "vulpix", "nidoran-m", "diglett", "growlithe", "magnemite", "exeggcute", "cubone", "koffing", "rhyhorn", "chansey", "kangaskhan", "staryu", "scyther", "jynx", "electabuzz", "tauros", "lapras", "porygon", "aerodactyl", "snorlax"]) staticFiles.set(`/pokemon-art/${id}.png`, [`pokemon-art/${id}.png`, 'image/png']);
for (const dex of [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 26, 28, 33, 34, 36, 38, 51, 53, 55, 57, 59, 64, 65, 67, 68, 80, 82, 89, 91, 93, 94, 103, 105, 110, 112, 121, 130, 148, 149]) staticFiles.set(`/pokemon-art/forms/${dex}.png`, [`pokemon-art/forms/${dex}.png`, 'image/png']);
for (const trainer of [...civilianProfiles, ...Object.values(gymLeaderProfiles), ...Object.values(roleProfiles).flat(), ...Object.values(partnerProfiles), 'blue', 'mina', 'trace']) {
  const path = `trainer-models/${trainer}.glb`;
  staticFiles.set(`/${path}`, [path, 'model/gltf-binary']);
}
for (const name of ['felt', 'tabletop', ...civilianProfiles]) {
  const path = `system-art/${name}.webp`;
  staticFiles.set(`/${path}`, [path, 'image/webp']);
}
staticFiles.set('/system-art/rocket-mark.svg', ['system-art/rocket-mark.svg', 'image/svg+xml']);
staticFiles.set('/system-art/settings.svg', ['system-art/settings.svg', 'image/svg+xml']);
for (const track of [...Object.values(musicTracks), ...recordedMoves.map(move=>`moves/${move}`)]) {
  const path = `audio/${track}.mp3`;
  staticFiles.set(`/${path}`, [path, 'audio/mpeg']);
}
for (const path of pokemonTypeIconPaths) {
  staticFiles.set(path, [path.slice(1), 'image/png']);
}
const modelFiles = /^\/pokemon-models\/([1-9]\d{0,2})\.glb$/;
const vendorFiles = new Map([
  ['/vendor/three.module.js', join(appDir, 'node_modules/three/build/three.module.js')],
  ['/vendor/three.core.js', join(appDir, 'node_modules/three/build/three.core.js')],
  ...['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','utils/SkeletonUtils.js','objects/Reflector.js'].map(file=>
    [`/vendor/addons/${file}`,join(appDir,'node_modules/three/examples/jsm',file)]),
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

export function createApplication({ store, dataDir = join(appDir, '.data'), publicDir = join(appDir, 'public'), catalogue, now, cleanupIntervalMs = 30_000, publicOrigin } = {}) {
  const rooms = store || new RoomStore({ dataDir, catalogue: catalogue || JSON.parse(readFileSync(join(appDir, 'content', 'catalogue.json'), 'utf8')), now });
  const server = createHttpServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      // The fixed public allowlist is deliberate: private files are never URL-resolved.
      const path = req.url.split('?')[0];
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
      if (req.method === 'POST') {
        const allowedOrigin = publicOrigin ?? `http://${req.headers.host}`;
        if (req.headers.origin && req.headers.origin !== allowedOrigin) throw new ApiError(403, 'ORIGIN_REJECTED', 'Cross-origin writes are unavailable.');
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
        const source = readFileSync(vendorFiles.get(path),'utf8');
        const data = path.startsWith('/vendor/addons/')
          ? source.replaceAll("from 'three'", "from '/vendor/three.module.js'")
          : source;
        res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'});
        return res.end(data);
      }
      const model = modelFiles.exec(path);
      const asset = model ? [`pokemon-models/${model[1]}.glb`, 'model/gltf-binary'] : staticFiles.get(path);
      if (req.method === 'GET' && asset) {
        let data;
        try { data = readFileSync(join(publicDir, asset[0])); }
        catch (error) { if (error.code === 'ENOENT') throw new ApiError(404, 'NOT_FOUND', 'File not found.'); throw error; }
        const cacheable = asset[1] === 'model/gltf-binary' || asset[1] === 'audio/mpeg';
        const headers = { 'Content-Type': asset[1], 'Content-Length': data.length, ...(cacheable ? {'Cache-Control':'public, max-age=86400'} : {}) };
        if (asset[1] === 'audio/mpeg') {
          headers['Accept-Ranges'] = 'bytes';
          const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
          if (range && (range[1] || range[2])) {
            const start = range[1] ? Number(range[1]) : Math.max(0,data.length-Number(range[2]));
            const end = range[1] && range[2] ? Math.min(data.length-1,Number(range[2])) : data.length-1;
            if (start > end) {
              res.writeHead(416,{'Content-Range':`bytes */${data.length}`});
              return res.end();
            }
            res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${data.length}`});
            return res.end(data.subarray(start,end+1));
          }
        }
        res.writeHead(200, headers);
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
    const onRender = process.env.RENDER === 'true';
    const host = onRender ? '0.0.0.0' : '127.0.0.1';
    const publicOrigin = onRender ? new URL(process.env.RENDER_EXTERNAL_URL).origin : undefined;
    const { server } = createApplication({ publicOrigin });
    server.on('error', () => { console.error('Server could not listen. Check the configured port.'); process.exitCode = 1; server.close(); });
    server.listen(port, host, () => console.log(`Foundation running at ${publicOrigin ?? `http://${host}:${port}`}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  } catch { console.error('Startup failed. Check the catalogue and private saved-room data.'); process.exitCode = 1; }
}
