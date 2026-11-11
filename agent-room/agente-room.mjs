/* ============================================================
   BADCLAUDIO — AGENT ROOM 2D HI-FI (servidor)
   Escritorio pixel art 100% desenhado em codigo (sem sprites).
   Serve a cena em http://127.0.0.1:3399 e reflete o estado REAL
   da ponte (bridge local) em /api/room-status: online, canais,
   modelos, requisicoes e ultimo modelo servido.
   ============================================================ */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AGENT_ROOM_PORT || 3399);
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
const HTML_PATH = path.join(__dirname, 'index.html');
const ICO_PATH = path.join(__dirname, '..', 'claudio.ico');

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let cache = { at: 0, data: null };
async function bridgeStats() {
  const now = Date.now();
  if (cache.data && now - cache.at < 3000) return cache.data;
  let out = { online: false, keys: 0, models: 0, requests: 0, lastServed: null, server: BRIDGE_URL };
  try {
    const health = await fetch(BRIDGE_URL + '/health', { signal: AbortSignal.timeout(2000) });
    if (health.ok) {
      const h = await health.json();
      out.online = h.status === 'ok';
      out.keys = h.keys || 0;
      out.models = h.models || 0;
    }
    try {
      const stats = await fetch(BRIDGE_URL + '/stats', { signal: AbortSignal.timeout(2000) });
      if (stats.ok) {
        const s = await stats.json();
        out.requests = s.requests || 0;
        if (s.lastServed) out.lastServed = s.lastServed.model + ' via ' + s.lastServed.key;
      }
    } catch {}
  } catch {}
  cache = { at: now, data: out };
  return out;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/room-status') {
    const data = await bridgeStats();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = fs.readFileSync(HTML_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('index.html nao encontrado junto de agente-room.mjs');
    }
    return;
  }

  if (url.pathname === '/claudio.ico' || url.pathname === '/favicon.ico') {
    try {
      res.writeHead(200, { 'Content-Type': 'image/x-icon' });
      res.end(fs.readFileSync(ICO_PATH));
      return;
    } catch {}
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('nao encontrado');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Agent Room] HQ 2D em http://127.0.0.1:${PORT} (ponte: ${BRIDGE_URL})`);
});
