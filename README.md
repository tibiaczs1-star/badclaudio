# 🏴‍☠️ BadClaudio — Site Público (Catálogo CZS)

Site oficial do BadClaudio no Render + pacote do cliente para download.

## O que tem aqui

- `server.mjs` — servidor Node puro (zero dependências): página inicial, download do
  pacote do cliente e Agent Room 2D (demo).
- `agent-room/` — escritório 2D pixel art que reflete o estado do bridge local.
- `claudio-cli-clean.mjs` / `claudio-cli-normal.mjs` / `claude-bridge.js` — o cliente
  CLI entregue no pacote (sem nenhuma chave embutida).
- `CONDICOES-BADCLAUDIO.md` — compromisso comercial: preços, disponibilidade e estorno.

## Como rodar local

```bash
npm start          # site em http://127.0.0.1:3000
```

## Interface no seu computador (pacote do cliente)

```bash
node claudio-cli-clean.mjs     # Interface Clean (minimalista)
node claudio-cli-normal.mjs    # Interface Normal (mascote, missões, histórico)
```

O bridge local lê `chaves.json` (não incluído aqui — vai com o cliente ou é
configurado pelo servidor do administrador via `config.json` → `server_url`).

## Segurança

- Nenhuma chave de provedor neste repositório.
- Filtros de segurança da IA ativos; nenhuma promessa de modelo/gratuidade sem
  confirmação no catálogo ativo.
- Conexão remota exige HTTPS; HTTP só em localhost.

---
Catálogo CZS & Junior Play.
