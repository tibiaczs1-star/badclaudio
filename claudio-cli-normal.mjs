#!/usr/bin/env node
/* ============================================================
   BADCLAUDIO — INTERFACE NORMAL (CLI)  ·  visual "Modelo 1"
   Terminal operacional: mascote na lateral esquerda, menu na
   direita e painel de status separado. Layout montado 1 vez no
   topo e redraw a cada turno, sem biblioteca grafica.
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
      'Codigo na tela e ideia na cabeca.'
    ]
  }
};

// ---------------- config e estado ----------------
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

let tokensTotal = 0, requisicoes = 0, primeiraVez = false;
let DATA_PATH;
function carregarHistoria() {
  fs.mkdirSync(cfg.history_dir, { recursive: true });
  DATA_PATH = path.join(cfg.history_dir, 'historico.json');
  if (!fs.existsSync(DATA_PATH)) primeiraVez = true;
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
const useCor = process.stdout.isTTY !== false;
const C = (code) => s => useCor ? `\x1b[${code}m${s}\x1b[0m` : String(s);
const red = C('91'), cyn = C('96'), yel = C('93'), grn = C('92'), mag = C('95'),
      dim = C('90'), wht = C('97'), bold = C('1');

// ---------------- layout ----------------
const W = 78;
const MASCOTE = [
  '',
  '        /\\_/\\',
  '   ____/ o o \\____',
  '  /  _    ^    _  \\',
  ' |  / \\  BAD  / \\  |',
  '  \\_\\  CLAUDIO  /_/',
  '     \\_________/',
  '',
  ''
];
const MENU = [
  ['ENTER', 'descreva a tarefa'],
  ['/dica', 'dica para iniciante'],
  ['/stats', 'uso e endpoint'],
  ['/limpar', 'comeca conversa nova'],
  ['/titulo nome', 'renomeia a sessao'],
  ['/sair', 'encerra e salva']
];

function pad(s, n) {
  const limpo = String(s).replace(/\x1b\[[0-9;]*m/g, '');
  return String(s) + ' '.repeat(Math.max(0, n - limpo.length));
}
function linha(esq, dir) {
  const larguraEsq = 34, larguraDir = W - larguraEsq - 5;
  return dim('│') + ' ' + pad(esq, larguraEsq) + dim('│') + ' ' + pad(dir, larguraDir) + dim('│');
}
function topo(titulo) {
  const t = ` ${titulo} `;
  const sobra = W - 2 - t.length;
  return dim('╔') + wht(bold(t)) + dim('═'.repeat(Math.max(0, sobra))) + dim('╗');
}
function meio() { return dim('╠' + '═'.repeat(34 + 1) + '╩' + '═'.repeat(W - 34 - 3) + '╣'); }
function base() { return dim('╚' + '═'.repeat(W - 2) + '╝'); }
function barraStatus(extra) {
  const atual = MISSOES.camadas.filter(c => tokensTotal >= c.tokens).pop();
  const proxima = MISSOES.camadas.find(c => tokensTotal < c.tokens);
  const partes = [
    grn('● ' + (extra && extra.online ? 'ponte online' : 'ponte local')),
    cyn(fmt(tokensTotal) + ' tokens'),
    yel(atual ? 'camada: ' + atual.nome : 'camada: nenhuma'),
    dim(proxima ? 'proxima: ' + proxima.missao : 'ultima camada')
  ];
  return partes.join(dim('  │  '));
}

function desenhar(status) {
  const m = cfg.family_mode ? MISSOES.girias.familia : MISSOES.girias.normal;
  const fala = m[requisicoes % Math.max(1, m.length)];
  const linhas = [];
  linhas.push('');
  linhas.push(topo('BADCLAUDIO  ·  INTERFACE NORMAL'));
  for (let i = 0; i < Math.max(MASCOTE.length, MENU.length); i++) {
    let esq = MASCOTE[i] !== undefined ? red(MASCOTE[i]) : '';
    if (i === MASCOTE.length && i > 0) esq = '';
    let dir = '';
    if (MENU[i]) dir = cyn(pad(MENU[i][0], 13)) + dim(MENU[i][1]);
    linhas.push(linha(esq, dir));
  }
  linhas.push(linha('', ''));
  linhas.push(dim('│') + ' ' + pad(mag(fala.length > 32 ? fala.slice(0, 31) + '…' : fala), W - 4) + ' ' + dim('│'));
  linhas.push(meio());
  linhas.push(linha('', ''));
  linhas.push(dim('│') + ' ' + pad(barraStatus(status), W - 4) + ' ' + dim('│'));
  linhas.push('') ;
  linhas.push(dim('  ' + (DATA_PATH || '') ));
  console.log(linhas.join('\n'));
}

// ---------------- conexao ----------------
function baseUrl() {
  if (cfg.server_url && !String(cfg.server_url).includes('SEU-DOMINIO') && /^https:\/\//.test(cfg.server_url)) {
    return cfg.server_url.trim().replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:' + (process.env.BRIDGE_PORT || 20129);
}
const SYSTEM_PROMPT = `Voce e o BAD CLAUDE / Claudio, assistente CLI direto, bem-humorado e focado em resultado pratico.
Responda em portugues do Brasil, curto e objetivo. Voce tem filtros de seguranca e segue as regras dos provedores e da legislacao.
Nao prometa modelos, gratuidades ou capacidades nao confirmadas. Quando algo nao der, avise curto e ofereca alternativa util.`;

async function chatting(messages) {
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
    let d = ''; try { d = (await res.text()).slice(0, 180); } catch {}
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
  const ponte = spawn(process.execPath, [path.join(__dirname, 'claude-bridge.js')], {
    cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe']
  });
  ponte.stdout.on('data', () => {});
  ponte.stderr.on('data', () => {});
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
console.clear?.();
desenhar({ online });
console.log(dim('  conversa nova · escreva o que precisa e ENTER\n'));

const TIPS = [
  'Usa "cd pasta" para entrar na pasta do projeto.',
  'Usa "git status" antes de alterar o codigo.',
  'Usa "npm test" para conferir se nao quebrou nada.',
  'A seta para cima repete o ultimo comando.',
  'Salva antes de fechar: o historico fica em ' + (DATA_PATH || '.claudio')
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let conversa = [];
let tituloSessao = 'Sessao ' + new Date().toISOString().slice(0, 10);

function perguntar() { rl.setPrompt(grn('claudio> ')); rl.prompt(); }
let fila = Promise.resolve();
rl.on('line', l => { fila = fila.then(() => processar(l)).catch(() => perguntar()); });
rl.on('close', () => { fila.then(() => { salvarHistoria({ titulo: tituloSessao, timestamp: new Date().toISOString(), tokens_sessao: tokensTotal, mensagens: conversa }); console.log('\n' + mag('É isso, velhinho! (historico salvo)')); process.exit(0); }); });

async function processar(line) {
  const texto = line.trim();
  if (!texto) return perguntar();
  if (texto === '/sair') { rl.close(); return; }
  if (texto === '/limpar') { conversa = []; console.log(dim('  conversa limpa.')); return perguntar(); }
  if (texto === '/dica') { console.log(yel('  ' + TIPS[requisicoes % TIPS.length])); return perguntar(); }
  if (texto === '/stats') {
    console.log('  ' + barraStatus({ online }));
    console.log(dim('  endpoint: ' + baseUrl() + ' · requisicoes: ' + requisicoes));
    return perguntar();
  }
  if (texto.startsWith('/titulo ')) { tituloSessao = texto.slice(8).trim(); console.log(dim('  titulo: ' + tituloSessao)); return perguntar(); }

  conversa.push({ role: 'user', content: texto });
  process.stdout.write(dim('  ...'));
  try {
    const r = await chatting(conversa);
    conversa.push({ role: 'assistant', content: r });
    process.stdout.write('\r' + ' '.repeat(10) + '\r');
    console.log('\n' + wht(r) + '\n');
  } catch (e) {
    process.stdout.write('\r' + ' '.repeat(10) + '\r');
    console.log(red('  nao deu: ' + e.message));
    console.log(dim('  confere a ponte (chaves.json) ou o server_url do config.json\n'));
  }
  perguntar();
}
perguntar();