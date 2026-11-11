/* ============================================================
   BADCLAUDIO — SERVIDOR PUBLICO (Render)
   Serve o site do Catálogo CZS: pagina inicial, download do
   pacote do cliente e o Agent Room 2D (versao demo offline).
   A IA em si roda no bridge local do cliente (claude-bridge.js);
   aqui nao ha chaves nem segredos de nenhum provedor.
   ============================================================ */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function safeJoin(root, rel) {
  const f = path.join(root, rel);
  return (f === root || f.startsWith(root + path.sep)) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

function home() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BadClaudio — Catálogo CZS</title>
<link rel="icon" href="/claudio.ico">
<style>
:root{--r:#ff164f;--p:#ff52b8;--c:#18dbff;--bg:#0b0c10}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:#eee;font:16px/1.6 Consolas,monospace}
.wrap{max-width:860px;margin:0 auto;padding:40px 22px}
h1{color:var(--r);font-size:34px;letter-spacing:1px}
.sub{color:var(--c);margin-top:-6px}
.card{border:1px solid #3a1520;border-left:4px solid var(--r);background:#101218;padding:18px;margin:16px 0}
a.btn{display:inline-block;background:var(--r);color:#fff;text-decoration:none;padding:12px 22px;font-weight:700;margin-top:10px}
a.btn.alt{background:#17191f;border:1px solid var(--p);color:var(--p)}
ul{margin:8px 0}
hr{border:0;border-top:1px solid #2a2c36;margin:26px 0}
small{color:#889}
</style></head><body><div class="wrap">
<h1>🏴‍☠️ BADCLAUDIO</h1>
<div class="sub">IA de personalidade direta, focada em entrega prática.</div>

<div class="card">
<b>Como usar</b>
<ul>
<li><b>Interface Clean</b> — CLI minimalista: <code>node claudio-cli-clean.mjs</code></li>
<li><b>Interface Normal</b> — CLI completa com mascote e missões: <code>node claudio-cli-normal.mjs</code></li>
<li><b>Agent Room 2D</b> — escritório pixel art: <a href="/agent-room/">abrir demo</a></li>
</ul>
<a class="btn" href="/download">BAIXAR PACOTE DO CLIENTE</a>
<a class="btn alt" href="/agent-room/">VER AGENT ROOM 2D</a>
</div>

<div class="card">
<b>Condições comerciais</b>
<p>Preços podem mudar para novas compras e renovações; métodos de acesso podem mudar ou
deixar de funcionar. O BadClaudio garante estorno proporcional dos tokens pagos e não
utilizados, mediante solicitação. Veja os detalhes em
<a href="/CONDICOES-BADCLAUDIO.md" style="color:var(--c)">CONDICOES-BADCLAUDIO.md</a>.</p>
</div>

<div class="card">
<b>Segurança e honestidade</b>
<p>A IA possui filtros de segurança e segue as regras dos provedores e a legislação.
Este pacote não contém chaves de nenhum provedor. Nenhum modelo, gratuidade ou
economia é prometido sem confirmação no catálogo ativo.</p>
</div>

<hr>
<small>Catálogo CZS — BadClaudio por Junior Play. Conexões locais: Bridge 127.0.0.1:20129 • Agent Room 127.0.0.1:3399.</small>
</div></body></html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rel = url.pathname.replace(/^\/+/, '');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(home());
    return;
  }

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname === '/download') {
    const zip = safeJoin(__dirname, 'publico-site.zip');
    if (zip) {
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Claudio-Seguro-Cliente.zip"' });
      res.end(fs.readFileSync(zip));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Pacote ainda nao publicado. Consulte o atendimento.');
    return;
  }

  // Agent Room demo e demais arquivos estaticos
  const file = safeJoin(__dirname, rel);
  if (file) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('nao encontrado');
});

server.listen(PORT, () => {
  console.log(`[BadClaudio Site] ONLINE em http://127.0.0.1:${PORT}`);
});
