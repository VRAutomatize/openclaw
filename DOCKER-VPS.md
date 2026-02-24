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

**1.2 Diretórios para instalações persistentes (uv, npm, go)**

Para que `uv tool install`, `npm install -g` e `go install` persistam no volume, crie os diretórios uma vez:

```bash
sudo mkdir -p /home/admin/.openclaw/uv-tools/bin /home/admin/.openclaw/npm-global/bin
sudo chown -R 1000:1000 /home/admin/.openclaw/uv-tools /home/admin/.openclaw/npm-global
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

Mantenha um arquivo no host, ex.: `/home/admin/openclaw.env`. Use como referência o exemplo em [docs/deploy/openclaw.env.vps.example](docs/deploy/openclaw.env.vps.example). Inclua pelo menos:

- **PATH** com os diretórios do volume primeiro:  
  `PATH=/home/node/.openclaw/bin:/home/node/.openclaw/uv-tools/bin:/home/node/.openclaw/npm-global/bin:/home/node/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
- **Persistência de instaladores:**  
  `UV_TOOL_DIR=/home/node/.openclaw/uv-tools`, `UV_TOOL_BIN_DIR=/home/node/.openclaw/uv-tools/bin`,  
  `NPM_CONFIG_PREFIX=/home/node/.openclaw/npm-global`, `GOBIN=/home/node/.openclaw/bin`
- `OPENCLAW_GATEWAY_TOKEN=...`, `OPENCLAW_GATEWAY_BIND=lan`
- Chaves de API (OPENROUTER, OPENAI, ANTHROPIC, ELEVENLABS, etc.)

O container será iniciado com `--env-file` apontando para esse arquivo.

## 4. Sequência completa de deploy / recriação

Ordem recomendada na VPS (com sudo sem senha):

**4.1 Preparar volume e permissões**

```bash
sudo mkdir -p /home/admin/.openclaw /home/admin/.openclaw/uv-tools/bin /home/admin/.openclaw/npm-global/bin
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
| **Volume** `/home/admin/.openclaw` | openclaw.json, credentials/, identity/, workspace/, agents/, bin/, uv-tools/, npm-global/, tools/ (downloads por skill), devices/, logs/, cron/, delivery-queue/, etc. |
| **Host** `/home/admin/openclaw.env` | PATH, UV_TOOL_DIR, NPM_CONFIG_PREFIX, GOBIN, OPENCLAW_GATEWAY_*, chaves de API |
| **Imagem Docker** | Código do app, ffmpeg, ALSA, summarize, go, jq, python3, cron |

Com o env correto (seção 3), instalações feitas pelo agente ou pelo fluxo de skill install (`uv tool install`, `npm install -g`, `go install`) caem no volume e persistem entre rebuilds.

## 7. Instaladores de skills e persistência

O gateway suporta cinco tipos de instalador para dependências de skills: **download**, **node**, **uv**, **go**, **brew**.

| Tipo | Onde instala (com env da seção 3) | Persiste? |
|------|-------------------------------------|-----------|
| **download** | `~/.openclaw/tools/<skill>/` | Sim (volume) |
| **node** | `~/.openclaw/npm-global` (NPM_CONFIG_PREFIX) | Sim |
| **uv** | `~/.openclaw/uv-tools` (UV_TOOL_DIR) | Sim |
| **go** | `~/.openclaw/bin` (GOBIN) | Sim |
| **brew** | Não disponível na imagem; ver secção 9 | — |

Garanta que o volume tem permissão 1000:1000 e que os diretórios uv-tools e npm-global existam (seção 1.2). Assim pode instalar novas skills sem erros de permissão ou perda após rebuild.

## 8. Alterações no container pelo agente

O processo do gateway corre como utilizador **node** (uid 1000), não root.

- **Opção A (recomendada):** O agente pode alterar tudo o que está no volume (config, workspace, scripts, binários em bin/, uv-tools/, npm-global/). Para instalar pacotes de sistema (apt), é necessário fazer rebuild da imagem com o Dockerfile actualizado e recriar o container.
- **Opção B (avançada):** Se quiser que o agente possa instalar pacotes Debian sob demanda, pode instalar `sudo` na imagem e configurar no container permissão restrita (ex.: `node ALL=(root) NOPASSWD: /usr/bin/apt-get update, /usr/bin/apt-get install -*`). Mantenha GOBIN/UV_TOOL_DIR/NPM_CONFIG_PREFIX no volume para que instalações de linguagens continuem persistentes.

## 9. Skills que exigem Brew (opcional)

A imagem principal não inclui Homebrew. Para skills que declaram `kind: "brew"`:

- **Opção 1:** Instale o binário manualmente noutra máquina (ou no host da VPS) e copie para `/home/admin/.openclaw/bin/` no volume (dono 1000:1000). O PATH já inclui esse diretório.
- **Opção 2:** Use uma imagem derivada que inclua Linuxbrew (ex.: padrão do [Dockerfile.sandbox-common](Dockerfile.sandbox-common)), aceitando maior tamanho de imagem.
