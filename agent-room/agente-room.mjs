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

  // bolha inteligente: pergunta curta a IA da bridge (fallback local se cair)
  if (url.pathname === '/api/agent-chatter' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      let agent = 'agente', context = 'no escritorio';
      try { const b = JSON.parse(body); agent = String(b.agent || agent).slice(0, 40); context = String(b.context || context).slice(0, 120); } catch {}
      const prompt = `Voce e o agente "${agent}" do escritorio BadClaudio, acabou de ${context}. Responda em UMA frase curta (max 10 palavras), informal, em portugues.`;
      try {
        const r = await fetch(BRIDGE_URL + '/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-fable-5.1-free', max_tokens: 60, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(8000)
        });
        if (r.ok) {
          const d = await r.json();
          const line = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
          if (line) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ line: line.slice(0, 120), source: 'bridge' }));
            return;
          }
        }
      } catch {}
      const fallbacks = [
        'bora pra cima, time!', 'cafe primeiro, deploy depois.',
        'missao cumprida, proxima!', 'a ponte ta voando hoje.',
        'tudo verde no rack.', 'guardei o progresso, tranquilo.'
      ];
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ line: fallbacks[(Math.random() * fallbacks.length) | 0], source: 'fallback' }));
    });
    return;
  }

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

  // assets de sprite da base 2D (PNG)
  if (url.pathname.startsWith('/assets/')) {
    const rel = url.pathname.slice('/assets/'.length).replace(/\.\./g, '');
    const file = path.join(__dirname, 'assets', rel);
    if (file.startsWith(path.join(__dirname, 'assets')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': file.endsWith('.png') ? 'image/png' : 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      res.end(fs.readFileSync(file));
      return;
    }
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
