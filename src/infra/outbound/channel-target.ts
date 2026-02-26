import { MESSAGE_ACTION_TARGET_MODE } from "./message-action-spec.js";

export const CHANNEL_TARGET_DESCRIPTION =
  "Recipient: E.164 for WhatsApp/Signal DMs (e.g. +5511999999999); WhatsApp groups use numeric JID ending with @g.us (e.g. 120363423629363956@g.us). From session key agent:main:whatsapp:group:NNN@g.us use target NNN@g.us. Telegram: chat id/@username; Discord/Slack: channel/user; iMessage: handle/chat_id";

export const CHANNEL_TARGETS_DESCRIPTION =
  "Recipient/channel targets (same format as --target); accepts ids or names when the directory is available.";

export function applyTargetToParams(params: {
  action: string;
  args: Record<string, unknown>;
}): void {
  const target = typeof params.args.target === "string" ? params.args.target.trim() : "";
  const hasLegacyTo = typeof params.args.to === "string";
  const hasLegacyChannelId = typeof params.args.channelId === "string";
  const mode =
    MESSAGE_ACTION_TARGET_MODE[params.action as keyof typeof MESSAGE_ACTION_TARGET_MODE] ?? "none";

  if (mode !== "none") {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error("Use `target` instead of `to`/`channelId`.");
    }
  } else if (hasLegacyTo) {
    throw new Error("Use `target` for actions that accept a destination.");
  }

  if (!target) {
    return;
  }
  if (mode === "channelId") {
    params.args.channelId = target;
    return;
  }
  if (mode === "to") {
    params.args.to = target;
    return;
  }
  throw new Error(`Action ${params.action} does not accept a target.`);
}
