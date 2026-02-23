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

### 4. Volume persistente

Para não perder config, credenciais e workspace ao recriar o container:

- **Volumes**: adicione um volume (Volume ou Bind)
- **Container path**: `/home/node/.openclaw`
- Assim persistem: `openclaw.json`, credentials, workspace, sessions, etc.

### 5. Deploy

- **Deploy** (ou Save + Start). O build pode demorar alguns minutos (pnpm install + build).
- Após subir, acesse pelo domínio configurado no EasyPanel (ex.: `https://openclaw.seudominio.com`).
- Na primeira vez: use o token em **Settings → token** na Control UI.

### 6. Onboarding e canais (opcional)

O container sobe com `--allow-unconfigured`. Para configurar modelo, canais e skills:

- Use um **job one-shot** no EasyPanel (ou outro container temporário) com a mesma imagem e o mesmo volume montado em `/home/node/.openclaw`, e rode:
  - `node dist/index.js onboard`
- Ou faça a config manualmente editando `openclaw.json` no volume e reinicie o app.

## Resumo rápido

| Item | Valor |
|------|--------|
| Build | Dockerfile (raiz do repo) |
| Porta do app | 18789 |
| Env obrigatório | `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_BIND=lan` |
| Volume | `/home/node/.openclaw` (persistir config + workspace) |

## Referências

- [Docker (OpenClaw)](docs/install/docker.md) — setup local com Docker Compose
- [EasyPanel — App Service](https://easypanel.io/docs/services/app) — domínios, env, volumes
