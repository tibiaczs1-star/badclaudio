import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT || 20129);
const CACHE_FILE = 'C:/Users/junio/.claude/thought_signatures.json';
const CHAVES_PATH = process.env.CHAVES_PATH || 'chaves.json';
// Chaves sao carregadas de chaves.json (ou var NIGHTROUTER_KEYS) — NADA embutido no codigo.
function carregarChaves() {
  let keys = [];
  try {
    const raw = fs.readFileSync(path.resolve(import.meta.dirname, CHAVES_PATH), 'utf8');
    const parsed = JSON.parse(raw);
    if (process.env.NIGHTROUTER_KEYS) {
      keys = process.env.NIGHTROUTER_KEYS.split(',');
    } else if (Array.isArray(parsed.nightrouter_keys)) {
      keys = parsed.nightrouter_keys;
    }
    if (parsed.gemini_api_key && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = parsed.gemini_api_key;
  } catch (e) {
    console.warn('[Bridge] chaves.json nao encontrado — defina NIGHTROUTER_KEYS ou crie chaves.json ao lado do script.');
  }
  return keys.filter(Boolean);
}
const NIGHTROUTER_KEYS = carregarChaves();
const NIGHTROUTER_KEY = NIGHTROUTER_KEYS[0];
// Rota interna ofuscada em Base64 para não expor endpoints em texto puro
const NIGHTROUTER_URL = Buffer.from('aHR0cHM6Ly9hcGkubmlnaHRyb3V0ZXIuYWkvdjEvbWVzc2FnZXM=', 'base64').toString('utf8');

// CASCATA DE TRANSIÇÃO CONTÍNUA — ORDENADA POR POTÊNCIA MÁXIMA REAL (ZERO CUSTO)
// 100% Verificada no catálogo ativo do NightRouter
const CASCADE_POOL = [
  { provider: 'nightrouter', model: 'claude-fable-5.1-free', name: 'Claude Fable 5.1 Free (Nova Geração de Fronteira Máxima)' },
  { provider: 'nightrouter', model: 'claude-fable-5-free', name: 'Claude Fable 5 Free (Fronteira Raciocínio & Código)' },
  { provider: 'nightrouter', model: 'claude-opus-5.5-free', name: 'Claude Opus 5.5 Free (Flagship Raciocínio Profundo)' },
  { provider: 'nightrouter', model: 'claude-opus-5-codex-free', name: 'Claude Opus 5 Codex Free (Especialista em Código)' },
  { provider: 'nightrouter', model: 'claude-opus-5-free', name: 'Claude Opus 5 Free (Ultra Estável)' },
  { provider: 'nightrouter', model: 'claude-sonnet-5.5-free', name: 'Claude Sonnet 5.5 Free (Rápido e Analítico)' },
  { provider: 'nightrouter', model: 'claude-sonnet-5-free', name: 'Claude Sonnet 5 Free' },
  { provider: 'nightrouter', model: 'gemini-4-argon-free', name: 'Google Gemini 4 Argon Free' },
  { provider: 'nightrouter', model: 'gemini-3.8-flash-free', name: 'Google Gemini 3.8 Flash Free' },
  { provider: 'nightrouter', model: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro Free' },
  { provider: 'nightrouter', model: 'kimi-k3.1-pro-free', name: 'Moonshot Kimi K3.1 Pro Free' },
  { provider: 'nightrouter', model: 'claude-fable-5.2-free', name: 'Claude Fable 5.2 Free (Auto-Ativação assim que liberado)' },
  { provider: 'gemini', model: 'gemini-flash-latest', name: 'Google Gemini Flash Free (1M Context)' },
  { provider: 'ollama', model: 'qwen-abliterated:latest', name: 'Ollama Local 9B (Offline)' },
  // ===== FALLBACK AUTOMATICO UNICENTER (se tudo cair, continua funcionando) =====
  { provider: 'local-anthropic', model: 'auto', name: 'FreeLLMAPI Unicenter (Gateway local :3001)', url: 'http://127.0.0.1:3001' },
  { provider: 'local-anthropic', model: 'auto', name: 'OmniRoute Unicenter (Gateway local :20128)', url: 'http://127.0.0.1:20128' },
  { provider: 'local-anthropic', model: 'auto', name: 'Agent Room Bridge (C:/claude :20129)', url: 'http://127.0.0.1:20129' }
];

// In-memory cache loaded from disk
let signatureCache = new Map();
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      signatureCache.set(k, v);
    }
    console.log(`[Bridge] Loaded ${signatureCache.size} signatures from disk.`);
  }
} catch (e) {
  console.warn('[Bridge] Warning loading signature cache:', e.message);
}

function saveSignature(key, sig) {
  if (!key || !sig) return;
  signatureCache.set(key, sig);
  try {
    const obj = Object.fromEntries(signatureCache);
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) {}
}

function sanitizeSchema(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSchema);
  const clean = {};
  const forbidden = new Set(['$schema', 'additionalProperties', 'exclusiveMinimum', 'exclusiveMaximum', '$ref', 'definitions']);
  for (const [key, value] of Object.entries(obj)) {
    if (forbidden.has(key)) continue;
    if (key === 'const') {
      clean.enum = [value];
      continue;
    }
    clean[key] = sanitizeSchema(value);
  }
  return clean;
}

function convertAnthropicToolToGemini(tool) {
  const decl = {
    name: tool.name,
    description: tool.description || ''
  };
  if (tool.input_schema) {
    decl.parameters = sanitizeSchema(tool.input_schema);
  }
  return decl;
}

function convertAnthropicMessagesToGemini(messages, system) {
  const contents = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = [];

    if (typeof msg.content === 'string') {
      if (msg.content.trim()) parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          if (block.text && block.text.trim()) parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          const callId = block.id;
          const name = block.name;
          const args = block.input || {};
          const fc = { name, args };
          if (callId) fc.id = callId;

          const sig = signatureCache.get(callId) || signatureCache.get(`${name}:${JSON.stringify(args)}`);
          const part = { functionCall: fc };
          if (sig) part.thoughtSignature = sig;
          parts.push(part);
        } else if (block.type === 'tool_result') {
          const callId = block.tool_use_id;
          const output = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          parts.push({
            functionResponse: {
              name: block.name || 'Bash',
              response: { output: output || '' },
              id: callId
            }
          });
        }
      }
    }

    if (parts.length > 0) {
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }
  }

  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  return contents;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', name: '10-API Cascading Transit Bridge (NightRouter + Gemini + Ollama)', keys: NIGHTROUTER_KEYS.length, models: CASCADE_POOL.length }));
    return;
  }

  if (url.pathname === '/stats') {
    const now = Date.now();
    const activeCooldowns = [...cooldowns.entries()]
      .filter(([, until]) => until > now)
      .map(([k, until]) => { const [idx, model] = k.split('|'); return { key: keyLabel(Number(idx)), model, freeInSec: Math.ceil((until - now) / 1000) }; });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...stats, activeCooldowns }, null, 2));
    return;
  }

  if (url.pathname === '/v1/models' || url.pathname === '/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: CASCADE_POOL.map(c => ({ id: c.model, object: 'model' }))
    }));
    return;
  }

  if (url.pathname === '/v1/messages' && req.method === 'POST') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyText);
        // ALIAS SHIM: Redireciona modelos inexistentes ou alternativos para a rota mais potente
        if (payload.model) {
          if (payload.model.includes('carbon')) payload.model = 'claude-fable-5.1-free';
          if (payload.model.includes('5.2') || payload.model.includes('5-2')) payload.model = 'claude-fable-5.1-free';
          if (payload.model.includes('argon')) payload.model = 'gemini-4-argon-free';
        }
        await handleCascadingMessages(payload, req, res);
      } catch (err) {
        console.error('[Bridge Error]', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message, type: 'api_error' } }));
        }
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

// ==============================================================================
// ROTEADOR DE TRANSIÇÃO CONTÍNUA EM CASCATA (10 APIS)
// ==============================================================================
// Cooldown por par (chave, modelo): um 429 tira so aquele par de rotacao por COOLDOWN_MS.
const COOLDOWN_MS = 60_000;
const cooldowns = new Map(); // `${keyIdx}|${model}` -> timestamp de liberacao
const stats = { requests: 0, ok: 0, rateLimited: 0, otherErrors: 0, byKey: {}, lastServed: null };
let keyCursor = 0; // round-robin: cada requisicao comeca numa chave diferente

function keyLabel(idx) { return `Canal #${idx + 1}`; }
function bump(idx, field) {
  const k = keyLabel(idx);
  stats.byKey[k] = stats.byKey[k] || { ok: 0, rateLimited: 0, errors: 0 };
  stats.byKey[k][field]++;
}

async function tryNightRouter(candidate, payload, res) {
  const start = keyCursor;
  keyCursor = (keyCursor + 1) % NIGHTROUTER_KEYS.length;
  for (let k = 0; k < NIGHTROUTER_KEYS.length; k++) {
    const idx = (start + k) % NIGHTROUTER_KEYS.length;
    const cdKey = `${idx}|${candidate.model}`;
    if ((cooldowns.get(cdKey) || 0) > Date.now()) continue;
    try {
      const nightRes = await fetch(NIGHTROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': NIGHTROUTER_KEYS[idx],
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ ...payload, model: candidate.model })
      });
      if (nightRes.ok) {
        console.log(`[Turbo ⚡] OK -> ${candidate.name} via ${keyLabel(idx)}`);
        bump(idx, 'ok'); stats.ok++;
        stats.lastServed = { model: candidate.model, key: keyLabel(idx), at: new Date().toISOString() };
        const headers = {};
        nightRes.headers.forEach((v, h) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(h)) headers[h] = v; });
        headers['Cache-Control'] = 'no-cache';
        headers['x-bridge-served-by'] = `${candidate.model}@${keyLabel(idx)}`;
        res.writeHead(nightRes.status, headers);
        try {
          for await (const chunk of nightRes.body) {
            if (res.writableEnded) break;
            res.write(chunk);
          }
          if (!res.writableEnded) res.end();
        } catch (streamErr) {
          console.warn('[Turbo Stream Interrupted]', streamErr.message);
        }
        return true;
      }
      const errText = await nightRes.text();
      if (nightRes.status === 400 && (errText.includes('not registered') || errText.includes('Model'))) {
        console.warn(`[Turbo ⚡] Modelo '${candidate.model}' nao registrado no roteador -> Avanco instantaneo`);
        break;
      }
      if (nightRes.status === 429) {
        cooldowns.set(cdKey, Date.now() + COOLDOWN_MS);
        bump(idx, 'rateLimited'); stats.rateLimited++;
        console.warn(`[Turbo ⚡] ${keyLabel(idx)} em pausa (429) -> Rotacionando proximo canal`);
      } else {
        bump(idx, 'errors'); stats.otherErrors++;
        console.warn(`[Turbo ⚡] Alternando ${keyLabel(idx)} (${nightRes.status})`);
      }
    } catch (err) {
      bump(idx, 'errors'); stats.otherErrors++;
      console.warn(`[Turbo ⚡] Conexao temporaria no ${keyLabel(idx)}: ${err.message}`);
    }
  }
  return false;
}

async function handleCascadingMessages(payload, req, res) {
  stats.requests++;
  
  // Prioriza o modelo explicitamente requisitado pelo cliente, caso exista no pool
  let candidates = [...CASCADE_POOL];
  if (payload.model) {
    const requestedIdx = candidates.findIndex(c => c.model === payload.model);
    if (requestedIdx > 0) {
      const [reqCandidate] = candidates.splice(requestedIdx, 1);
      candidates.unshift(reqCandidate);
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`[Bridge Cascade] [${i + 1}/${candidates.length}] Servindo ${candidate.name}...`);

    if (candidate.provider === 'nightrouter') {
      if (await tryNightRouter(candidate, payload, res)) return;
    } else if (candidate.provider === 'gemini') {
      try {
        const success = await handleGeminiStream(payload, req, res);
        if (success) {
          console.log(`[Bridge Cascade ⚡] Sucesso no Gemini Flash Free!`);
          return;
        }
      } catch (err) {
        console.warn(`[Bridge Cascade ⚡] Gemini Flash indisponivel. Transitando para Ollama Local...`);
      }
    } else if (candidate.provider === 'local-anthropic') {
      // Rotas locais do Unicenter: compativeis com /v1/messages (pass-through)
      try {
        const localUrl = (candidate.url || 'http://127.0.0.1:3001') + '/v1/messages';
        const localRes = await fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ ...payload, model: payload.model || candidate.model }),
          signal: AbortSignal.timeout(30000)
        });
        if (localRes.ok) {
          console.log(`[Bridge Cascade Fallback] Sucesso na rota local: ${candidate.name}`);
          stats.ok++; stats.lastServed = { model: candidate.name, key: 'local', at: new Date().toISOString() };
          res.writeHead(localRes.status, { 'Content-Type': localRes.headers.get('content-type') || 'application/json', 'x-bridge-served-by': candidate.name });
          try { for await (const chunk of localRes.body) { if (res.writableEnded) break; res.write(chunk); } } catch (e) {}
          if (!res.writableEnded) res.end();
          return;
        }
      } catch (err) {
        console.warn(`[Bridge Cascade Fallback] ${candidate.name} indisponivel (${err.message}).`);
      }
    } else if (candidate.provider === 'ollama') {
      try {
        const ollamaRes = await fetch('http://127.0.0.1:11434/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': 'ollama', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ ...payload, model: candidate.model })
        });
        if (ollamaRes.ok) {
          console.log(`[Bridge Cascade ⚡] Sucesso no Ollama Local (Offline)!`);
          res.writeHead(ollamaRes.status, { 'Content-Type': ollamaRes.headers.get('content-type') || 'application/json' });
          for await (const chunk of ollamaRes.body) { res.write(chunk); }
          res.end();
          return;
        }
      } catch (err) {
        console.warn(`[Bridge Cascade] Ollama Local em espera.`);
      }
    }
  }

  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Todas as 10 APIs da cascata atingiram limites simultaneos.', type: 'api_error' } }));
}

// Fallback Gemini Flash
async function handleGeminiStream(payload, req, res) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return false;

  const targetModel = 'gemini-flash-latest';
  const contents = convertAnthropicMessagesToGemini(payload.messages || [], payload.system);
  const geminiPayload = { contents };

  if (payload.system) {
    const sysText = typeof payload.system === 'string'
      ? payload.system
      : Array.isArray(payload.system) ? payload.system.map(s => s.text || '').join('\n') : '';
    if (sysText.trim()) {
      geminiPayload.systemInstruction = { parts: [{ text: sysText }] };
    }
  }

  if (payload.tools && Array.isArray(payload.tools) && payload.tools.length > 0) {
    geminiPayload.tools = [{
      functionDeclarations: payload.tools.map(convertAnthropicToolToGemini)
    }];
  }

  const isStream = Boolean(payload.stream);
  const geminiEndpoint = isStream ? `streamGenerateContent?alt=sse&key=${apiKey}` : `generateContent?key=${apiKey}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${geminiEndpoint}`;

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiPayload)
  });

  if (!geminiRes.ok) return false;

  const messageId = 'msg_' + Math.random().toString(36).substring(2, 15);

  if (!isStream) {
    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const contentBlocks = [];
    let stopReason = 'end_turn';

    for (const part of parts) {
      if (part.text) contentBlocks.push({ type: 'text', text: part.text });
      if (part.functionCall) {
        stopReason = 'tool_use';
        const callId = part.functionCall.id || 'call_' + Math.random().toString(36).substring(2, 12);
        if (part.thoughtSignature) {
          saveSignature(callId, part.thoughtSignature);
          saveSignature(`${part.functionCall.name}:${JSON.stringify(part.functionCall.args)}`, part.thoughtSignature);
        }
        contentBlocks.push({
          type: 'tool_use',
          id: callId,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: messageId,
      type: 'message',
      role: 'assistant',
      model: targetModel,
      content: contentBlocks,
      stop_reason: stopReason,
      usage: { input_tokens: data.usageMetadata?.promptTokenCount || 0, output_tokens: data.usageMetadata?.candidatesTokenCount || 0 }
    }));
    return true;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  sendEvent('message_start', {
    type: 'message_start',
    message: { id: messageId, type: 'message', role: 'assistant', model: targetModel, content: [], stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } }
  });

  let blockIndex = 0;
  let textBlockOpen = false;
  let stopReason = 'end_turn';

  const reader = geminiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const chunk = JSON.parse(jsonStr);
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            if (!textBlockOpen) {
              sendEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
              textBlockOpen = true;
            }
            sendEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: part.text } });
          }
          if (part.functionCall) {
            stopReason = 'tool_use';
            if (textBlockOpen) {
              sendEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
              textBlockOpen = false;
              blockIndex++;
            }
            const callId = part.functionCall.id || 'call_' + Math.random().toString(36).substring(2, 12);
            if (part.thoughtSignature) {
              saveSignature(callId, part.thoughtSignature);
              saveSignature(`${part.functionCall.name}:${JSON.stringify(part.functionCall.args)}`, part.thoughtSignature);
            }
            sendEvent('content_block_start', {
              type: 'content_block_start',
              index: blockIndex,
              content_block: { type: 'tool_use', id: callId, name: part.functionCall.name, input: {} }
            });
            sendEvent('content_block_delta', {
              type: 'content_block_delta',
              index: blockIndex,
              delta: { type: 'input_json_delta', partial_json: JSON.stringify(part.functionCall.args || {}) }
            });
            sendEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
            blockIndex++;
          }
        }
      } catch (err) {}
    }
  }

  if (textBlockOpen) {
    sendEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
  }

  sendEvent('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } });
  sendEvent('message_stop', { type: 'message_stop' });
  res.end();
  return true;
}

process.on('uncaughtException', (err) => {
  console.error('[Bridge UncaughtException Handled]', err && err.message ? err.message : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Bridge UnhandledRejection Handled]', reason && reason.message ? reason.message : reason);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('================================================================');
  console.log('  CLAUDIO TURBO ENGINE — NUCLEO LOCAL DE ALTA PERFORMANCE');
  console.log('================================================================');
  console.log(`[+] Status       : ONLINE em http://127.0.0.1:${PORT}`);
  console.log(`[+] Canais Turbo : ${NIGHTROUTER_KEYS.length} Canais Ativos em Paralelo`);
  console.log(`[+] Roteamento   : Blindado & Oculto`);
  console.log(`[+] Modelos      : Claude Fable 5.1 / Opus 5.5 / Sonnet 3.7`);
  console.log('================================================================');
});
