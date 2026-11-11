/* ============================================================
   BADCLAUDIO — AGENT ROOM 2D (PIXEL ART)
   Escritorio visual que abre junto com o BadClaudio.
   Serve a sala em http://127.0.0.1:3399 e consulta o bridge
   para mostrar estado real dos canais e do chat.

   Como usar: node agente-room.mjs  (ou e iniciado junto pelo
   Iniciar-Claudio / claudio-cli-normal)
   ============================================================ */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AGENT_ROOM_PORT || 3399);
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
const HTML_PATH = path.join(__dirname, 'index.html');
const ASSETS_DIR = path.join(__dirname, 'assets');

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

let lastStatus = null;
async function refreshStatus() {
  try {
    const r = await fetch(BRIDGE_URL + '/health', { signal: AbortSignal.timeout(2000) });
    if (r.ok) { lastStatus = await r.json(); return; }
  } catch {}
  lastStatus = null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/room-status') {
    await refreshStatus();
    const online = Boolean(lastStatus && lastStatus.status === 'ok');
    const keys = lastStatus ? (lastStatus.keys || 0) : 0;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      online,
      keys,
      models: lastStatus ? (lastStatus.models || 0) : 0,
      server: BRIDGE_URL
    }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const html = fs.readFileSync(HTML_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('index.html nao encontrado junto de agente-room.mjs');
    }
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    const rel = url.pathname.replace('/assets/', '').replace(/\.\./g, '').replace(/\\/g, '');
    const file = path.join(ASSETS_DIR, rel);
    if (file.startsWith(ASSETS_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('nao encontrado');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Agent Room] Escritorio 2D em http://127.0.0.1:${PORT} (bridge: ${BRIDGE_URL})`);
});
