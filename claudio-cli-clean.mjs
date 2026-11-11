#!/usr/bin/env node
/* ============================================================
   BADCLAUDIO — INTERFACE CLEAN (CLI MINIMALISTA)
   Sem mascote, sem girias, sem historico em arquivo.
   Apenas chat direto com a IA via bridge local ou servidor
   HTTPS do config.json. Sinal limpo, resposta limpa.
   ============================================================ */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

function carregarConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
const cfg = carregarConfig();

function baseUrl() {
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) {
    return cfg.server_url.trim().replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
}

async function garantirBridge() {
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) return;
  try {
    const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(2500) });
    if (r.ok) return;
  } catch {}
  const { spawn } = await import('child_process');
  const bridge = spawn(process.execPath, [path.join(__dirname, 'claude-bridge.js')], {
    cwd: __dirname, detached: false, stdio: ['ignore', 'pipe', 'pipe']
  });
  bridge.stdout.on('data', () => {});
  bridge.stderr.on('data', () => {});
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[aviso] bridge local nao respondeu; confira chaves.json / claude-bridge.js');
}

const SYSTEM_PROMPT = `Voce e o Claudio (modo Clean), assistente CLI objetivo.
Responda em portugues do Brasil, direto ao ponto, sem enrolacao. Segue filtros de seguranca e regras dos provedores. Nao prometa capacidades nao confirmadas.`;

async function chat(messages) {
  const res = await fetch(baseUrl() + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.model || 'claude-fable-5.1-free',
      max_tokens: Number(cfg.max_tokens || 2048),
      system: SYSTEM_PROMPT,
      messages
    })
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    throw new Error('HTTP ' + res.status + (detail ? ' — ' + detail : ''));
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

console.log('BadClaudio Clean — /sair para encerrar. Endpoint: ' + baseUrl());
await garantirBridge();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
let conversa = [];
rl.prompt();

let fila = Promise.resolve();
rl.on('line', (line) => { fila = fila.then(() => processarLinha(line)).catch(() => rl.prompt()); });
rl.on('close', () => { fila.then(() => process.exit(0)); });

async function processarLinha(line) {
  const texto = line.trim();
  if (!texto) { rl.prompt(); return; }
  if (texto === '/sair') { rl.close(); process.exit(0); }
  if (texto === '/limpar') { conversa.length = 0; rl.prompt(); return; }
  conversa.push({ role: 'user', content: texto });
  try {
    const resposta = await chat(conversa);
    conversa.push({ role: 'assistant', content: resposta });
    console.log('\n' + resposta + '\n');
  } catch (e) {
    console.log('[erro] ' + e.message);
  }
  rl.prompt();
}
