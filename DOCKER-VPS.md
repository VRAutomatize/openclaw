# Deploy OpenClaw no VPS com Docker (persistência completa)

Deploy manual do gateway em um VPS usando Docker, com um único volume para estado (config, pairing, credenciais, binários em `bin/`) e env file no host. Assim tudo persiste entre rebuilds e recriações do container.

## Pré-requisitos

- Docker instalado no VPS
- Repositório clonado (ex.: `/home/admin/openclaw`)
- Arquivo de ambiente com token, PATH e chaves de API (ex.: `/home/admin/openclaw.env`)

## 1. Volume e permissões (uma vez)

O container roda como usuário `node` (uid 1000). O diretório do estado no host deve existir e pertencer a 1000:1000 para o gateway escrever config, workspace e devices (pairing).

```bash
sudo mkdir -p /home/admin/.openclaw
sudo chown -R 1000:1000 /home/admin/.openclaw
```

## 2. Config mínima (Control UI por HTTP)

Para o dashboard conectar por HTTP (ex.: `http://IP:18789`) sem exigir device identity (HTTPS ou localhost), o `openclaw.json` no volume deve ter:

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

Se o arquivo já existir, **mescle** essa chave com o JSON existente. Script fornecido (rodar no host, com o repo clonado):

```bash
sudo python3 /home/admin/openclaw/scripts/ensure-control-ui-device-auth.py /home/admin/.openclaw/openclaw.json
sudo chown 1000:1000 /home/admin/.openclaw/openclaw.json
```

## 3. Variáveis de ambiente (host)

Mantenha um arquivo no host, ex.: `/home/admin/openclaw.env`, com pelo menos:

- `PATH=/home/node/.openclaw/bin:/home/node/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
- `OPENCLAW_GATEWAY_TOKEN=...`
- `OPENCLAW_GATEWAY_BIND=lan`
- Chaves de API (OPENROUTER, OPENAI, ANTHROPIC, ELEVENLABS, etc.)

O container será iniciado com `--env-file` apontando para esse arquivo.

## 4. Sequência completa de deploy / recriação

Ordem recomendada na VPS (com sudo sem senha):

**4.1 Preparar volume e permissões**

```bash
sudo mkdir -p /home/admin/.openclaw
sudo chown -R 1000:1000 /home/admin/.openclaw
```

**4.2 Garantir config Control UI (se ainda não fez)**

```bash
sudo python3 /home/admin/openclaw/scripts/ensure-control-ui-device-auth.py /home/admin/.openclaw/openclaw.json
sudo chown 1000:1000 /home/admin/.openclaw/openclaw.json
```

**4.3 Build da imagem**

```bash
cd /home/admin/openclaw
git pull --rebase origin main
sudo docker build -t openclaw-vra:latest .
```

**4.4 Parar e remover o container antigo (se existir)**

```bash
sudo docker stop openclaw-standalone 2>/dev/null || true
sudo docker rm openclaw-standalone 2>/dev/null || true
```

**4.5 Subir o novo container**

```bash
sudo docker run -d \
  --name openclaw-standalone \
  --restart unless-stopped \
  -p 18789:18789 \
  -v /home/admin/.openclaw:/home/node/.openclaw \
  --env-file /home/admin/openclaw.env \
  openclaw-vra:latest
```

**4.6 Verificar**

```bash
sudo docker ps --filter name=openclaw-standalone
sudo docker logs openclaw-standalone --tail 20
```

## 5. Usar Docker Compose (opcional)

O repositório inclui `docker-compose.vps.yml`. Com o estado e o env file nos paths padrão:

```bash
cd /home/admin/openclaw
export OPENCLAW_STATE_DIR=/home/admin/.openclaw
export OPENCLAW_ENV_FILE=/home/admin/openclaw.env
sudo docker compose -f docker-compose.vps.yml build
sudo docker compose -f docker-compose.vps.yml up -d
```

Para apenas subir (imagem já construída):

```bash
sudo docker compose -f docker-compose.vps.yml up -d
```

## 6. O que fica persistente

| Onde | O que |
|------|--------|
| **Volume** `/home/admin/.openclaw` | openclaw.json, credentials/, identity/, workspace/, agents/, bin/ (gog, uv, sag, nano-pdf), devices/, logs/, cron/, delivery-queue/, etc. |
| **Host** `/home/admin/openclaw.env` | PATH, OPENCLAW_GATEWAY_*, chaves de API |
| **Imagem Docker** | Código do app, ffmpeg, ALSA, summarize (em /usr/local/bin) |

Binários instalados manualmente em `/home/node/.openclaw/bin` (no volume) persistem enquanto o volume for o mesmo. O summarize é instalado na imagem pelo Dockerfile e persiste entre rebuilds.
