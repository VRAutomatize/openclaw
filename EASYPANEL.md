# Deploy OpenClaw no EasyPanel (GitHub)

Este projeto é configurado para rodar no [EasyPanel](https://easypanel.io) a partir do repositório no GitHub. Build usa o `Dockerfile` na raiz; o gateway escuta na porta **18789**.

## Pré-requisitos

- Servidor com EasyPanel instalado
- Repositório no GitHub (este fork) com acesso de leitura pelo EasyPanel

## Passo a passo no EasyPanel

### 1. Novo App a partir do GitHub

- **Create** → **App**
- **Source**: GitHub
- Conecte a conta/org e escolha o repositório (ex.: `VRAutomatize/openclaw`)
- Branch: `main` (ou a que você usar)
- **Build**: Dockerfile (EasyPanel detecta o `Dockerfile` na raiz)

### 2. Porta

- **Domains & Proxy** (ou Ports): o gateway usa a porta **18789**
- Configure o proxy/porta pública apontando para a porta **18789** do container (Target port = 18789)

### 3. Variáveis de ambiente

Na aba **Environment** do serviço, defina:

| Variável | Obrigatório | Exemplo / Notas |
|----------|------------|------------------|
| `OPENCLAW_GATEWAY_TOKEN` | Sim | Token para auth (ex.: `openssl rand -hex 32` no seu PC) |
| `OPENCLAW_GATEWAY_BIND` | Sim | `lan` (para escutar em 0.0.0.0 e aceitar conexões externas) |

Sem `OPENCLAW_GATEWAY_BIND=lan`, o gateway fica em loopback e não é acessível fora do container.

### 4. Volume persistente (obrigatório para não perder pairing)

Para **não** perder config, credenciais, **pairing de dispositivos** e workspace ao reiniciar ou fazer deploy:

- **Volumes**: adicione um volume (Volume ou Bind) e **mantenha o mesmo volume** em todos os deploys.
- **Container path**: `/home/node/.openclaw`
- O gateway grava o estado de pairing em `.../devices/` (pending.json, paired.json). Se esse diretório não for persistido (volume novo, path errado ou sem volume), **toda reinicialização ou deploy** vai pedir pairing de novo.
- Assim persistem: `openclaw.json`, credentials, **devices (pairing)**, workspace, sessions, etc.

Se você montar o estado em outro path (ex.: `/data/.openclaw`), defina a variável de ambiente `OPENCLAW_STATE_DIR=/data/.openclaw` para o app usar esse diretório.

### 5. Deploy

- **Deploy** (ou Save + Start). O build pode demorar alguns minutos (pnpm install + build).
- Após subir, acesse pelo domínio configurado no EasyPanel (ex.: `https://openclaw.seudominio.com`).
- Na primeira vez: use o token em **Settings → token** na Control UI (veja [Troubleshooting](#troubleshooting) se aparecer "unauthorized").

### 6. Onboarding e canais (opcional)

O container sobe com `--allow-unconfigured`. Para configurar modelo, canais e skills:

- Use um **job one-shot** no EasyPanel (ou outro container temporário) com a mesma imagem e o mesmo volume montado em `/home/node/.openclaw`, e rode:
  - `node dist/index.js onboard`
- Ou faça a config manualmente editando `openclaw.json` no volume e reinicie o app.

### 7. OpenRouter como principal (evitar Opus caro)

Para rodar com **OpenRouter** como provedor principal (uma API key, vários modelos) e não usar Claude Opus 4.6 como padrão:

1. **Env no EasyPanel:** defina `OPENROUTER_API_KEY` com sua chave (ex.: `sk-or-v1-...`). O gateway usa essa chave para todos os modelos `openrouter/...`.

2. **Config no volume:** edite `openclaw.json` em `/home/node/.openclaw/` (ou use a aba Config do dashboard após conectar) e defina **modelo padrão** e **fallbacks** via OpenRouter. Exemplo equilibrado (Sonnet como principal, fallbacks mais baratos):

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/anthropic/claude-sonnet-4-5",
        "fallbacks": [
          "openrouter/openai/gpt-4o-mini",
          "openrouter/google/gemini-2.0-flash-001",
          "openai/gpt-4o"
        ]
      },
      "models": {
        "openrouter/anthropic/claude-sonnet-4-5": { "alias": "Sonnet (OR)" },
        "openrouter/anthropic/claude-opus-4-6": { "alias": "Opus (OR)" },
        "openrouter/openai/gpt-4o": { "alias": "GPT-4o (OR)" },
        "openrouter/openai/gpt-4o-mini": { "alias": "GPT-4o mini (OR)" },
        "openrouter/google/gemini-2.0-flash-001": { "alias": "Gemini Flash (OR)" },
        "openai/gpt-4o": { "alias": "GPT-4o" },
        "anthropic/claude-opus-4-6": { "alias": "Opus (direto)" }
      }
    }
  }
}
```

- **primary:** o modelo usado por padrão (Sonnet via OpenRouter é mais barato que Opus).
- **fallbacks:** se o primary falhar (limite, erro), o gateway tenta na ordem: gpt-4o-mini, Gemini Flash, etc. Você pode trocar a ordem ou os IDs conforme [OpenRouter](https://openrouter.ai/docs#models).
- **models:** catálogo + aliases; assim o `/model` no chat lista opções legíveis e você (ou o agente) pode mudar de modelo quando fizer sentido.

3. **“Melhor modelo para a tarefa”:** o OpenClaw **não** escolhe sozinho o modelo por tipo de tarefa. Ele usa sempre o **primary** e, em caso de falha, os **fallbacks** em ordem. Para aproximar de “usar o melhor/custo”: (a) deixe um primary capaz e barato (ex.: Sonnet ou gpt-4o-mini via OpenRouter) e fallbacks variados; (b) no workspace, em `AGENTS.md`, você pode instruir o agente a preferir modelos mais baratos para tarefas simples e a sugerir `/model` quando a tarefa for pesada.

4. **Anthropic / OpenAI direto:** você pode manter as chaves da Anthropic e da OpenAI no auth (para fallbacks diretos ou uso manual). O primary e os primeiros fallbacks via OpenRouter usam só `OPENROUTER_API_KEY`.

Reinicie o app após alterar o config (ou aguarde o hot reload do gateway).

### Depois de um rebuild (só quando der "pairing required")

Se você **manteve o mesmo volume** em `/home/node/.openclaw`, o pairing e a config costumam continuar válidos — não precisa aprovar de novo. Só quando o volume é **novo** (ou você trocou de volume) aparece "pairing required" de novo.

**Comandos (só nesse caso):** abra o **Shell** do container do app no EasyPanel e rode:

```bash
node dist/index.js devices list
```

Anote o `requestId` do pedido pendente e aprove:

```bash
node dist/index.js devices approve <requestId>
```

Depois recarregue o dashboard e clique em **Connect**. Se pedir token, use o valor de `OPENCLAW_GATEWAY_TOKEN` do EasyPanel (Settings ou URL com `#token=...`).

## Resumo rápido

| Item | Valor |
|------|--------|
| Build | Dockerfile (raiz do repo) |
| Porta do app | 18789 |
| Env obrigatório | `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_BIND=lan` |
| Volume | `/home/node/.openclaw` (obrigatório: config, **pairing**, workspace) |

## Troubleshooting

### "unauthorized" / token_missing (code 1008)

A Control UI precisa do **gateway token** para conectar. O token é o valor que você definiu em `OPENCLAW_GATEWAY_TOKEN` no EasyPanel.

**Opção 1 — Colar nas configurações**

1. Abra a URL do app (ex.: `https://claws-openclaw.ckqqav.easypanel.host`).
2. Na tela de conexão, abra **Settings** (ou a engrenagem).
3. No campo de token, cole o valor de `OPENCLAW_GATEWAY_TOKEN` (copie da aba Environment do EasyPanel).
4. Salve e conecte de novo.

**Opção 2 — Token na URL (só na primeira vez)**

Abra a URL com o token no hash (o navegador não envia o hash ao servidor, então é seguro):

```
https://SEU-DOMINIO/#token=COLE_SEU_TOKEN_AQUI
```

A Control UI lê o token do hash, grava em localStorage e remove o hash da barra de endereço.

Se você não tiver mais o token, defina de novo `OPENCLAW_GATEWAY_TOKEN` no EasyPanel (Environment), reinicie o app e use esse novo valor.

**Importante:** O token do gateway **não** é a chave da OpenAI, OpenRouter, etc. É um valor longo e aleatório que você define só para o OpenClaw (ex.: `openssl rand -hex 32`). Se na Overview aparecer algo que parece chave de API, troque pelo token correto.

### "pairing required" toda vez que reinicio ou faço deploy

Isso acontece quando o **estado de pairing** não está persistido. O gateway guarda dispositivos aprovados em `~/.openclaw/devices/` (no container: `/home/node/.openclaw/devices/`).

**Confira:**

1. **Volume** no EasyPanel: existe um volume (ou bind mount) com **Container path** = `/home/node/.openclaw`?
2. **Mesmo volume em todo deploy**: ao fazer "Redeploy" ou "Update", o EasyPanel deve **reutilizar** esse volume, não criar um novo. Se o app foi recriado do zero (novo volume), o pairing volta ao zero.
3. Se você usa outro path no container (ex.: `/data`), defina `OPENCLAW_STATE_DIR` com esse path (ex.: `OPENCLAW_STATE_DIR=/data/.openclaw`) e monte o volume nesse path.

Depois de garantir o volume, aprove o dispositivo de novo (comandos abaixo). Nos próximos reinícios/deploys **com o mesmo volume**, não precisará aprovar de novo.

### "pairing required" (após o token estar certo)

Quando você acessa o dashboard **por domínio** (não localhost), o gateway exige **aprovação do dispositivo** na primeira vez, mesmo com token correto.

**O que fazer:**

1. No EasyPanel, abra um **Shell** ou **Console** no container do app (ou use "Run command" / exec no container).
2. Dentro do container, rode (o working directory deve ser o do app, onde está `dist/index.js`):

   ```bash
   node dist/index.js devices list
   ```

   Você verá uma lista de pedidos pendentes com um `requestId` (e.g. `abc123-def456-...`).

3. Aprove o dispositivo com o `requestId` que aparecer:

   ```bash
   node dist/index.js devices approve <requestId>
   ```

   Exemplo: `node dist/index.js devices approve abc123-def456-789`.

4. No navegador, recarregue o dashboard e clique em **Connect**. A conexão deve ser aceita.

Se o EasyPanel não tiver Shell, use um **job one-shot** ou outro container com a mesma imagem e o **mesmo volume** montado em `/home/node/.openclaw`, e rode os comandos acima (o estado de pairing fica nesse volume).

### "Proxy headers detected from untrusted address"

Esse aviso aparece porque o tráfego passa por um proxy (EasyPanel). A conexão **continua funcionando**; o aviso só indica que o gateway não está tratando esse proxy como "trusted" para fins de IP do cliente.

Para silenciar o aviso e permitir detecção correta do IP atrás do proxy, adicione no `openclaw.json` (no volume `/home/node/.openclaw`) a lista de IPs do proxy. Nos seus logs o `remote=` do proxy aparece como `10.11.0.11`; use esse IP ou o bloco que o EasyPanel usar:

```json5
{
  "gateway": {
    "trustedProxies": ["10.11.0.11"]
  }
}
```

Reinicie o app após alterar o config. Se o EasyPanel usar outro IP/CIDR, ajuste `trustedProxies` de acordo.

### "invalid connect params: at /device/nonce: must NOT have fewer than 1 characters"

O cliente enviou parâmetros de device pairing inválidos (nonce vazio). Recarregue a página e, na primeira conexão, use o token (Settings ou `#token=...`). Se o problema continuar, limpe o localStorage do site e tente de novo.

### WhatsApp: QR carrega para sempre / no celular diz "não foi possível, verifique sua internet"

Quando o gateway está em uma **VPS/servidor (datacenter)**, o WhatsApp pode **rejeitar** o pareamento ao escanear o QR: no celular aparece erro de conexão e no OpenClaw a tela fica em "carregando" porque a sessão nunca completa.

**O que fazer:**

1. **Escanear rápido** — O QR expira em poucos segundos. Clique em "Show QR", abra no celular **WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho** e escaneie na hora.
2. **Fazer o link em rede caseira** — Se mesmo assim falhar, faça o **link do WhatsApp uma vez no seu PC ou em uma máquina na sua rede** (gateway rodando localmente), onde o WhatsApp costuma aceitar. Depois copie a pasta de autenticação do WhatsApp (em `~/.openclaw` ou no volume, a pasta usada pelo canal WhatsApp) para o servidor/VPS e reinicie o gateway. Assim a sessão já vem “logada”.
3. **Celular sem VPN** — Desative VPN ou proxy no celular ao escanear.
4. **Conferir saída na VPS** — O gateway precisa de internet de saída para os servidores do WhatsApp. Teste: `curl -sI https://web.whatsapp.com` de dentro do container ou da VPS.

Se depois do link (em casa ou na VPS) o WhatsApp desconectar sozinho, pode ser restrição do WhatsApp a IP de datacenter; aí o uso estável costuma ser com a sessão feita em rede residencial e depois copiada, ou com um túnel (ex.: Tailscale) para o gateway.

## Referências

- [Docker (OpenClaw)](docs/install/docker.md) — setup local com Docker Compose
- [EasyPanel — App Service](https://easypanel.io/docs/services/app) — domínios, env, volumes
