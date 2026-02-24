---
summary: "Run the agent and exec on the same host as the gateway (status, logs, CLI)"
read_when:
  - You want the agent to run openclaw status, gateway status, or see logs on the gateway server
  - Gateway runs in Docker and you want exec on the container or on the host
title: "Agent and exec on same host"
---

# Agent and exec on same host

You can run the agent and have exec commands (e.g. `openclaw status`, `openclaw gateway status`, logs) execute on the **same server** where the OpenClaw gateway runs. No code changes are required; only configuration.

## Where things run

- **Gateway host**: the machine where `openclaw gateway` runs (VPS, server, or container).
- **Agent**: runs **inside the gateway process** on that host. See [Remote access](/gateway/remote): "Gateway runs the agent."
- **Exec**: can run in `sandbox`, `gateway`, or `node` ([Exec tool](/tools/exec)). For `openclaw status` and logs on the **same** server, exec must run there — i.e. on the **gateway host** or on a **node** that runs on the same machine.

## Scenario 1: Gateway in Docker (exec inside container)

When the gateway runs in Docker on a server, the agent already runs on that server (inside the gateway container). To have the agent run `openclaw status`, `openclaw gateway status`, or log commands **inside the container**:

1. **Set exec to the gateway host**

   In the gateway config (e.g. `openclaw.json` in the Docker volume):

   ```json
   {
     "tools": {
       "exec": {
         "host": "gateway",
         "security": "allowlist"
       }
     }
   }
   ```

   Exec tool calls then run **inside the gateway container**.

2. **CLI inside the container**

   The container already has the binary (e.g. `node dist/index.js` or `openclaw.mjs`). Exec uses the container `PATH`; the command the agent invokes must exist there (e.g. `node /app/dist/index.js status` or a wrapper on `PATH`). See [Docker](/install/docker) and the repo [docker-compose.yml](https://github.com/openclaw/openclaw/blob/main/docker-compose.yml).

3. **Exec approvals / allowlist**

   On the gateway host, allow the commands you want (e.g. the node binary or script that runs `openclaw status`, and optionally `tail`/`cat` for logs). Configure via [Exec approvals](/tools/exec-approvals) (allowlist for `host=gateway`). Example: add an allowlist entry for the CLI (e.g. `node` with args, or the path to `dist/index.js`) in `~/.openclaw/exec-approvals.json` on the gateway; see [Exec approvals - allowlist](/tools/exec-approvals#policy-knobs) for the schema.

Result: the agent runs on the same host (container) as the gateway and can run `openclaw status`, `openclaw gateway status`, and any log commands available in the container.

## Scenario 2: Exec on the physical host (gateway in Docker)

If you want the agent to run commands on the **host** (e.g. host-installed `openclaw` or systemd logs) while the gateway runs in Docker:

1. **Run a node on the same server, outside the container**

   On the host:

   ```bash
   openclaw node run --host 127.0.0.1 --port 18789 --display-name "Local Node"
   ```

   If the gateway binds only to loopback, ensure the host can reach it (e.g. with Docker port mapping, the host can use `127.0.0.1:18789`).

2. **Approve the node**

   On the gateway (e.g. via SSH to the server and CLI, or Control UI): [Nodes](/nodes) — approve the new node.

3. **Point exec at the node**

   In the gateway config:

   ```json
   {
     "tools": {
       "exec": {
         "host": "node",
         "security": "allowlist",
         "node": "<id-or-name-of-local-node>"
       }
     }
   }
   ```

   Ensure the host has OpenClaw CLI on `PATH` and (if needed) the same `~/.openclaw` or config so `openclaw status` works. Configure exec approvals on the **node host** (`~/.openclaw/exec-approvals.json` on the host) to allow the desired commands.

Result: the agent still runs on the same server (in the gateway container), but **exec** runs on the physical host, where you can use `openclaw status`, `openclaw gateway status`, and system logs.

## Summary

| Goal | What to do |
|------|------------|
| Agent on same server as gateway | Already the case: the gateway runs on the server and the agent runs inside it. |
| Commands like `openclaw status` / logs on the **same** server | Use `tools.exec.host: "gateway"` (exec inside container) or a **node on the host** with `tools.exec.host: "node"`. |
| Where to configure | Gateway config (`openclaw.json`): `tools.exec.host`, `tools.exec.node` (if using a node), and [Exec approvals](/tools/exec-approvals) on the gateway (and on the node host when using a node). |

Related: [Exec tool](/tools/exec), [Exec approvals](/tools/exec-approvals), [Nodes](/nodes), [Remote access](/gateway/remote).
