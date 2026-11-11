#!/usr/bin/env node
/* ============================================================
   BADCLAUDIO — INTERFACE NORMAL (CLI COMPLETA)
   Chat em shell: mascote ASCII, girias, camadas de tokens,
   historico local em arquivo, dicas para iniciante.
   Converte para chamadas Anthropic /v1/messages no bridge
   local (claude-bridge.js) ou no servidor HTTPS configurado.
   ============================================================ */
import readline from 'readline';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.USERPROFILE || process.env.HOME;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const MISsoes_DEFAULT = {
  camadas: [
    { tokens: 100000, nome: 'Primeiros Dentes', missao: 'Concluir a primeira tarefa real' },
    { tokens: 1000000, nome: 'Motor Ligado', missao: 'Finalizar um projeto pequeno' },
    { tokens: 5000000, nome: 'Tentaculo Coder', missao: 'Corrigir e testar um codigo' },
    { tokens: 25000000, nome: 'Esquadrao Ativo', missao: 'Usar tres modos do BadClaudio' },
    { tokens: 100000000, nome: 'Chefe de Oficina', missao: 'Entregar um projeto completo' },
    { tokens: 350000000, nome: 'Capitao Turbo', missao: 'Concluir cinco entregas verificadas' },
    { tokens: 800000000, nome: 'Monstro da Cota', missao: 'Otimizar um projeto grande' },
    { tokens: 1000000000, nome: 'Claudio Bilionario', missao: 'Atingir um bilhao de tokens acumulados' },
    { tokens: 5000000000, nome: 'Lenda do Terminal', missao: 'Manter uma sequencia de projetos concluidos' },
    { tokens: 10000000000, nome: 'Rei dos Tentaculos', missao: 'Atingir dez bilhoes de tokens acumulados' },
    { tokens: 20000000000, nome: 'BadClaudio Supremo', missao: 'Atingir vinte bilhoes de tokens acumulados' }
  ],
  girias: {
    normal: [
      'Porra, ta gastando, hein, playboy! Pra comprar memoria, nada.',
      'Se nao fosse eu, ja teria acabado a cota.',
      'Vai atras de um cocota... mas salva o projeto antes!',
      'Clica em mim, porra! Clica em mim, porra!',
      'O BadClaudio trabalha e o cooler que lute.'
    ],
    familia: [
      'Motor ligado. Bora trabalhar!',
      'Se nao fosse eu, essa tarefa ainda estava na fila.',
      'Salva o projeto antes de sair!',
      'Clica em mim para abrir a central.',
      'Codigo na tela e ideia na cabeca.'
    ]
  }
};

function carregarConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch {}
  if (!cfg.history_dir) cfg.history_dir = path.join(HOME, '.claudio');
  return cfg;
}
function carregarMissoes() {
  const p = path.join(__dirname, 'missoes.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return MISsoes_DEFAULT; }
}
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- historia local ----------
let tokensTotal = 0, requisicoes = 0, primeiraVez = false;
let DATA_PATH;
function carregarHistoria() {
  const dir = cfg.history_dir;
  fs.mkdirSync(dir, { recursive: true });
  DATA_PATH = path.join(dir, 'historico.json');
  let d = { tokens_total: 0, requisicoes: 0, sessoes: [] };
  try { d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch {}
  tokensTotal = d.tokens_total || 0;
  requisicoes = d.requisicoes || 0;
  if (!fs.existsSync(DATA_PATH)) primeiraVez = true;
  return d;
}
let history = [];
function salvarHistoria() {
  fs.writeFileSync(DATA_PATH, JSON.stringify({ tokens_total: tokensTotal, requisicoes: requisicoes, sessoes: history }, null, 2), 'utf8');
}

// ---------- apresentacao ----------
const MASCOTE = `
        /\\_/\\
   ____/ o o \\____
  /  _    ^    _  \\
 |  / \\  BAD  / \\  |
  \\_\\  CLAUDIO  /_/
     \\_________/`;

function banner() {
  console.log(MASCOTE);
  const m = carregarMissoes();
  const phrases = cfg.family_mode ? m.girias.familia : m.girias.normal;
  console.log('Mascote: ' + phrases[requisicoes % phrases.length]);
  console.log('Uso acumulado: ' + fmt(tokensTotal) + ' tokens');
  const atual = m.camadas.filter(c => tokensTotal >= c.tokens).pop();
  const proxima = m.camadas.find(c => tokensTotal < c.tokens);
  if (atual) console.log('Camada atual: ' + atual.nome);
  if (proxima) console.log('Proxima missao: ' + proxima.missao + ' (' + fmt(proxima.tokens) + ' tokens)');
  console.log('Modo: Interface Normal (CLI) — historico salvo em ' + DATA_PATH);
}

const TIPS = [
  'Usa "claude" no terminal para abrir o modo Power com skills.',
  'Usa "cd pasta" para entrar na pasta do projeto.',
  'Usa "git status" antes de alterar o codigo.',
  'Usa "npm test" para conferir se nao quebrou nada.',
  'Usa a seta para cima para repetir o ultimo comando.'
];

// ---------- conexao ----------
function baseUrl() {
  // bridge local por padrao; config.server_url HTTPS se configurado
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) {
    return cfg.server_url.trim().replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
}
function headers() {
  const h = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (cfg.license_id) h['authorization'] = 'Bearer ' + cfg.license_id;
  return h;
}

async function chat(messages, onDelta) {
  const res = await fetch(baseUrl() + '/v1/messages', {
    method: 'POST',
    headers: headers(),
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
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  tokensTotal += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  requisicoes++;
  return text;
}

const SYSTEM_PROMPT = `Voce e o BAD CLAUDE / Claudio, assistente CLI direto, bem-humorado e focado em resultado pratico.
Responda em portugues do Brasil, curto e objetivo. Voce tem filtros de seguranca e segue as regras dos provedores e da legislacao.
Nao prometa modelos, gratuidades ou capacidades nao confirmadas. Quando algo nao der, avise curto e ofereca alternativa util.`;

// ---------- loop ----------
const cfg = carregarConfig();
carregarHistoria();
banner();

// dica para iniciante na primeira vez
if (primeiraVez) {
  console.log('\n[DICA] ' + TIPS[0]);
  console.log('[DICA] ' + TIPS[1]);
}
if (!cfg.server_url || String(cfg.server_url).includes('SEU-DOMINIO')) {
  console.log('[INFO] Sem servidor HTTPS configurado. Modo local: iniciando bridge automaticamente...');
}

let connected = false;
async function garantirBridge() {
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) return; // remoto, nada a fazer
  try {
    const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(2500) });
    if (r.ok) { connected = true; return; }
  } catch {}
  // sobe o bridge como filho
  const { spawn } = await import('child_process');
  const bridge = spawn(process.execPath, [path.join(__dirname, 'claude-bridge.js')], {
    cwd: __dirname, detached: false, stdio: ['ignore', 'pipe', 'pipe']
  });
  bridge.stdout.on('data', d => { const s = String(d).trim(); if (s) process.stderr.write('[bridge] ' + s + '\n'); });
  bridge.stderr.on('data', d => { const s = String(d).trim(); if (s) process.stderr.write('[bridge-err] ' + s + '\n'); });
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok) { connected = true; return; }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('[AVISO] Bridge local nao respondeu. Verifique chaves.json / claude-bridge.js.');
}

await garantirBridge();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
let conversa = [];
let tituloSessao = 'Sessao ' + new Date().toISOString().slice(0, 10);

console.log('\nComandos: /sair /limpar /dica /stats /titulo <nome> — escreva sua tarefa e de ENTER.');
rl.prompt();

// Fila serial: uma linha por vez, mesmo quando varias chegam de uma vez (pipe/colagem)
let fila = Promise.resolve();
rl.on('line', (line) => {
  fila = fila.then(() => processarLinha(line)).catch(() => rl.prompt());
});
rl.on('close', () => {
  fila.then(fechar);
});
async function fechar() {
  try {
    history.push({ titulo: tituloSessao, timestamp: new Date().toISOString(), tokens_sessao: tokensTotal, mensagens: conversa });
    salvarHistoria();
  } catch {}
  process.exit(0);
}

async function processarLinha(line) {
  const texto = line.trim();
  if (!texto) { rl.prompt(); return; }
  if (texto === '/sair') { salvarHistoria(); console.log('É isso, velhinho! 🥕🏴‍☠️  (historico salvo)'); rl.close(); process.exit(0); }
  if (texto === '/limpar') { conversa.length = 0; console.log('Conversa limpa. Tarefa nova, cabeca nova.'); rl.prompt(); return; }
  if (texto === '/dica') { console.log('[DICA] ' + TIPS[requisicoes % TIPS.length]); rl.prompt(); return; }
  if (texto === '/stats') {
    console.log('Tokens acumulados: ' + fmt(tokensTotal));
    console.log('Requisicoes: ' + requisicoes);
    console.log('Endpoint: ' + baseUrl());
    rl.prompt(); return;
  }
  if (texto.startsWith('/titulo ')) { tituloSessao = texto.slice(8).trim(); console.log('Titulo: ' + tituloSessao); rl.prompt(); return; }

  conversa.push({ role: 'user', text: texto });
  try {
    const messages = conversa.map(m => ({ role: m.role, content: m.text }));
    const resposta = await chat(messages);
    conversa.push({ role: 'assistant', text: resposta });
    console.log('\nClaudio: ' + resposta + '\n');
  } catch (e) {
    console.log('\n[Claudio] Eita, nao deu: ' + e.message);
    console.log('[Claudio] Confere se o bridge esta ligado (chaves.json) ou configura server_url no config.json.\n');
  }
  rl.prompt();
}
