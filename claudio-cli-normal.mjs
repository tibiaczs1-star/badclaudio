#!/usr/bin/env node
/* ============================================================
   BADCLAUDIO — INTERFACE NORMAL (CLI)
   Visual no padrao dos melhores CLIs de terminal: letreiro em
   block letters com gradiente, mascote em arte de blocos a
   esquerda e painel de informacoes a direita, tudo dentro de
   uma moldura de largura fixa.
   ============================================================ */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.USERPROFILE || process.env.HOME;
const CONFIG_PATH = path.join(__dirname, 'config.json');

const MISSOES_DEFAULT = {
  camadas: [
    { tokens: 100000, nome: 'Primeiros Dentes', missao: 'Concluir a primeira tarefa real' },
    { tokens: 1000000, nome: 'Motor Ligado', missao: 'Finalizar um projeto pequeno' },
    { tokens: 5000000, nome: 'Tentaculo Coder', missao: 'Corrigir e testar um codigo' },
    { tokens: 25000000, nome: 'Esquadrao Ativo', missao: 'Usar tres modos do BadClaudio' },
    { tokens: 100000000, nome: 'Chefe de Oficina', missao: 'Entregar um projeto completo' },
    { tokens: 20000000000, nome: 'BadClaudio Supremo', missao: 'Atingir vinte bilhoes de tokens' }
  ],
  girias: {
    normal: [
      'O BadClaudio trabalha e o cooler que lute.',
      'Se nao fosse eu, ja teria acabado a cota.',
      'Guardei o progresso. Voce guarda o cafe.',
      'Missao dada e missao cumprida.',
      'Codigo na tela e ideia na cabeca.'
    ],
    familia: [
      'Motor ligado. Bora trabalhar!',
      'Se nao fosse eu, essa tarefa ainda estava na fila.',
      'Salva o projeto antes de sair!',
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
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'missoes.json'), 'utf8')); }
  catch { return MISSOES_DEFAULT; }
}
const cfg = carregarConfig();
const MISSOES = carregarMissoes();
const fmt = n => Number(n || 0).toLocaleString('pt-BR');

let tokensTotal = 0, requisicoes = 0;
let DATA_PATH;
function carregarHistoria() {
  fs.mkdirSync(cfg.history_dir, { recursive: true });
  DATA_PATH = path.join(cfg.history_dir, 'historico.json');
  try {
    const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    tokensTotal = d.tokens_total || 0;
    requisicoes = d.requisicoes || 0;
  } catch {}
}
let history = [];
function salvarHistoria(sessao) {
  try {
    if (sessao) history.push(sessao);
    fs.writeFileSync(DATA_PATH, JSON.stringify({ tokens_total: tokensTotal, requisicoes, sessoes: history }, null, 2), 'utf8');
  } catch {}
}

// ---------------- ANSI ----------------
const usoCor = process.stdout.isTTY !== false;
const cor = (n) => s => usoCor ? `\x1b[${n}m${s}\x1b[0m` : String(s);
const R = cor('38;5;203'), RED = cor('38;5;196'), AMB = cor('38;5;214'),
      CYN = cor('38;5;81'), WHT = cor('38;5;255'), DIM = cor('38;5;242'),
      PNK = cor('38;5;211'), GRN = cor('38;5;114'), YEL = cor('38;5;221'),
      BLD = cor('1');
const GRAD = ['196','203','209','215','221','227'].map(n => usoCor ? `\x1b[38;5;${n}m` : '');
const RST = usoCor ? '\x1b[0m' : '';

// ---------------- arte ----------------
const LOGO = [
  '██████╗  █████╗ ██████╗  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ██╗ ██████╗ ',
  '██╔══██╗██╔══██╗██╔══██╗██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██║██╔═══██╗',
  '██████╔╝███████║██║  ██║██║     ██║     ███████║██║   ██║██║  ██║██║██║   ██║',
  '██╔══██╗██╔══██║██║  ██║██║     ██║     ██╔══██║██║   ██║██║  ██║██║██║   ██║',
  '██████╔╝██║  ██║██████╔╝╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝██║╚██████╔╝',
  '╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ '
];
const W = 78;                 // largura total da moldura (inclui as bordas)
const L_ESQ = 31;             // coluna do menu
const L_DIR = W - L_ESQ - 6;  // coluna de informacoes

const strip = s => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const pad = (s, n) => {
  const t = strip(s);
  return t.length >= n ? s : s + ' '.repeat(n - t.length);
};
const row = (esq, dir) => DIM('│') + ' ' + pad(esq, L_ESQ) + DIM('│') + ' ' + pad(dir, L_DIR) + ' ' + DIM('│');
const full = (s) => DIM('│') + ' ' + pad(s, W - 4) + ' ' + DIM('│');
const topo = (titulo) => {
  const t = ' ' + titulo + ' ';
  return DIM('╭') + WHT(BLD(t)) + DIM('─'.repeat(Math.max(0, W - 2 - strip(t).length))) + DIM('╮');
};
const base = () => DIM('╰' + '─'.repeat(W - 2) + '╯');


function barraInfo(online) {
  const atual = MISSOES.camadas.filter(c => tokensTotal >= c.tokens).pop();
  const proxima = MISSOES.camadas.find(c => tokensTotal < c.tokens);
  return {
    canal: GRN('● ') + WHT(online ? 'ponte online' : 'ponte local'),
    tokens: CYN(fmt(tokensTotal) + ' tokens'),
    camada: YEL(atual ? atual.nome : 'iniciante'),
    proxima: DIM(proxima ? proxima.missao : 'avanco maximo')
  };
}

function desenhar(online) {
  const m = cfg.family_mode ? MISSOES.girias.familia : MISSOES.girias.normal;
  const fala = m[requisicoes % Math.max(1, m.length)];
  const info = barraInfo(online);
  const L = [];
  L.push('');
  LOGO.forEach((l, i) => L.push(GRAD[i % GRAD.length] + l + RST));
  L.push('');
  const menu = [
    CYN('ENTER') + '       ' + DIM('descreva a tarefa'),
    CYN('/dica') + '       ' + DIM('dica de iniciante'),
    CYN('/stats') + '      ' + DIM('uso e endpoint'),
    CYN('/limpar') + '     ' + DIM('nova conversa'),
    CYN('/sair') + '       ' + DIM('encerra e salva')
  ];
  const status = [
    DIM('canal    ') + info.canal,
    DIM('tokens   ') + info.tokens,
    DIM('camada   ') + info.camada,
    DIM('proxima  ') + info.proxima
  ];
  L.push(topo('CLI NORMAL'));
  L.push(full(WHT(BLD('BADCLAUDIO')) + DIM('   escritorio de agentes')));
  L.push(DIM('├' + '─'.repeat(W - 2) + '┤'));
  for (let i = 0; i < Math.max(menu.length, status.length); i++) {
    L.push(row(menu[i] || '', status[i] || ''));
  }
  L.push(full(''));
  L.push(full(PNK('"' + (fala.length > 40 ? fala.slice(0, 39) + '...' : fala) + '"')));
  L.push(base());
  L.push(DIM('  historico: ' + (DATA_PATH || '.claudio')));
  L.push('');
  console.log(L.join('\n'));
}

// ---------------- conexao ----------------
function baseUrl() {
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) {
    return cfg.server_url.trim().replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
}
const SYSTEM = `Voce e o BAD CLAUDE / Claudio, assistente CLI direto, bem-humorado e focado em resultado pratico.
Responda em portugues do Brasil, curto e objetivo. Voce tem filtros de seguranca e segue as regras dos provedores e da legislacao.
Nao prometa modelos, gratuidades ou capacidades nao confirmadas. Quando algo nao der, avise curto e ofereca alternativa util.`;

async function conversar(messages) {
  const res = await fetch(baseUrl() + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: cfg.model || 'claude-fable-5.1-free',
      max_tokens: Number(cfg.max_tokens || 2048),
      system: SYSTEM,
      messages
    })
  });
  if (!res.ok) {
    let d = ''; try { d = (await res.text()).slice(0, 160); } catch {}
    throw new Error('HTTP ' + res.status + (d ? ' — ' + d : ''));
  }
  const data = await res.json();
  tokensTotal += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  requisicoes++;
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function garantirPonte() {
  try {
    const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(2500) });
    if (r.ok) return true;
  } catch {}
  const { spawn } = await import('child_process');
  const p = spawn(process.execPath, [path.join(__dirname, 'claude-bridge.js')], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', () => {}); p.stderr.on('data', () => {});
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(baseUrl() + '/health', { signal: AbortSignal.timeout(1000) });
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ---------------- execucao ----------------
carregarHistoria();
const online = await garantirPonte();
if (process.stdout.isTTY) { try { process.stdout.write('\x1b[2J\x1b[H'); } catch {} }
desenhar(online);
console.log(DIM('  pronto. escreva a tarefa e de ENTER.') + '\n');

const TIPS = [
  'Usa "cd pasta" para entrar na pasta do projeto.',
  'Usa "git status" antes de alterar o codigo.',
  'Usa "npm test" para conferir se nao quebrou nada.',
  'A seta para cima repete o ultimo comando.',
  'O historico fica em ' + (DATA_PATH || '.claudio')
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let conversa = [];
let titulo = 'Sessao ' + new Date().toISOString().slice(0, 10);
const prompt = () => { rl.setPrompt(GRN('claudio> ')); rl.prompt(); };

let fila = Promise.resolve();
rl.on('line', l => { fila = fila.then(() => processar(l)).catch(() => prompt()); });
rl.on('close', () => {
  fila.then(() => {
    salvarHistoria({ titulo, timestamp: new Date().toISOString(), tokens_sessao: tokensTotal, mensagens: conversa });
    console.log('\n' + PNK('  Encerrado. Historico salvo.') + '\n');
    process.exit(0);
  });
});

async function processar(linha) {
  const t = linha.trim();
  if (!t) return prompt();
  if (t === '/sair') return rl.close();
  if (t === '/limpar') { conversa = []; console.log(DIM('  conversa limpa.')); return prompt(); }
  if (t === '/dica') { console.log(YEL('  ' + TIPS[requisicoes % TIPS.length])); return prompt(); }
  if (t === '/stats') {
    const i = barraInfo(online);
    console.log('  ' + i.canal + DIM('  ·  ') + i.tokens + DIM('  ·  ') + i.camada);
    console.log(DIM('  endpoint: ' + baseUrl() + '  ·  requisicoes: ' + requisicoes));
    return prompt();
  }
  if (t.startsWith('/titulo ')) { titulo = t.slice(8).trim(); console.log(DIM('  titulo: ' + titulo)); return prompt(); }

  conversa.push({ role: 'user', content: t });
  process.stdout.write(DIM('  pensando...'));
  try {
    const r = await conversar(conversa);
    conversa.push({ role: 'assistant', content: r });
    process.stdout.write('\r' + ' '.repeat(14) + '\r');
    console.log('\n' + WHT(r) + '\n');
  } catch (e) {
    process.stdout.write('\r' + ' '.repeat(14) + '\r');
    console.log(RED('  nao deu: ' + e.message));
    console.log(DIM('  confere a ponte (chaves.json) ou o server_url do config.json') + '\n');
  }
  prompt();
}
prompt();