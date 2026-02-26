import { missingTargetError } from "../infra/outbound/target-errors.js";
import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "./normalize.js";

export type WhatsAppOutboundTargetResolution =
  | { ok: true; to: string }
  | { ok: false; error: Error };

export function resolveWhatsAppOutboundTarget(params: {
  to: string | null | undefined;
  allowFrom: Array<string | number> | null | undefined;
  mode: string | null | undefined;
}): WhatsAppOutboundTargetResolution {
  const trimmed = params.to?.trim() ?? "";
  const allowListRaw = (params.allowFrom ?? [])
    .map((entry) => String(entry).trim())
    .filter(Boolean);
  const hasWildcard = allowListRaw.includes("*");
  const allowList = allowListRaw
    .filter((entry) => entry !== "*")
    .map((entry) => normalizeWhatsAppTarget(entry))
    .filter((entry): entry is string => Boolean(entry));

  if (trimmed) {
    const normalizedTo = normalizeWhatsAppTarget(trimmed);
    if (!normalizedTo) {
      const looksLikeGroupJid = /@g\.us$/i.test(trimmed);
      const hint = looksLikeGroupJid
        ? "WhatsApp group JID must be numeric (e.g. 120363423629363956@g.us). From session key agent:main:whatsapp:group:NNN@g.us use NNN@g.us as target."
        : "<E.164|group JID>";
      return {
        ok: false,
        error: missingTargetError("WhatsApp", hint),
      };
    }
    if (isWhatsAppGroupJid(normalizedTo)) {
      return { ok: true, to: normalizedTo };
    }
    // Enforce allowFrom for all direct-message send modes (including explicit).
    // Group destinations are handled by group policy and are allowed above.
    if (hasWildcard || allowList.length === 0) {
      return { ok: true, to: normalizedTo };
    }
    if (allowList.includes(normalizedTo)) {
      return { ok: true, to: normalizedTo };
    }
    return {
      ok: false,
      error: missingTargetError("WhatsApp", "<E.164|group JID>"),
    };
  }

  return {
    ok: false,
    error: missingTargetError("WhatsApp", "<E.164|group JID>"),
  };
}
