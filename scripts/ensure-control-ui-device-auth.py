#!/usr/bin/env python3
"""
One-shot script to ensure gateway.controlUi.dangerouslyDisableDeviceAuth is true
in openclaw.json so the Control UI can connect over HTTP (e.g. via IP) without
device identity. Run on the host where the state dir lives, e.g.:

  sudo python3 scripts/ensure-control-ui-device-auth.py /home/admin/.openclaw/openclaw.json

After running, ensure the file is owned by the container user (uid 1000):

  sudo chown 1000:1000 /home/admin/.openclaw/openclaw.json
"""

import json
import os
import sys


def main() -> None:
    if len(sys.argv) < 2:
        path = os.environ.get("OPENCLAW_JSON", "")
        if not path:
            print("Usage: ensure-control-ui-device-auth.py <path-to-openclaw.json>", file=sys.stderr)
            sys.exit(1)
    else:
        path = sys.argv[1]

    path = os.path.abspath(path)
    if not os.path.isfile(path):
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)

    cfg.setdefault("gateway", {})
    cfg["gateway"].setdefault("controlUi", {})
    if cfg["gateway"]["controlUi"].get("dangerouslyDisableDeviceAuth") is True:
        print("gateway.controlUi.dangerouslyDisableDeviceAuth already true")
        return

    cfg["gateway"]["controlUi"]["dangerouslyDisableDeviceAuth"] = True

    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

    print("Set gateway.controlUi.dangerouslyDisableDeviceAuth = true")


if __name__ == "__main__":
    main()
