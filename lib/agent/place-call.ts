// ===========================================================================
// Place a live AgentPhone call (lib/agent/place-call.ts)
//
// Shared helper that dials an AgentPhone number in WEBHOOK mode. We deliberately
// DO NOT send a systemPrompt — omitting it keeps the call in webhook mode, so
// AgentPhone POSTs every turn to /api/agentphone/webhook and GROK is the brain.
//
// Two-call sequence:
//   • "insurance" leg -> dials AGENTPHONE_TO_NUMBER  (verify benefits)
//   • "clinic"    leg -> dials AGENTPHONE_TO_NUMBER2 (book the consult)
// The clinic leg is fired automatically by the webhook when the insurance call
// ends. Each placed call's id is recorded so the webhook knows which leg it is.
// ===========================================================================

import { resolveAgentPhoneConfig } from "@/lib/config";
import { setCallType } from "@/lib/db";
import type { CallLeg } from "@/lib/agent/grok-brain";

const GREETINGS: Record<CallLeg, string> = {
  insurance:
    "Hi, this is Fairy calling on behalf of Maya and Daniel. I'm helping them verify their fertility benefits. Do you have a moment?",
  clinic:
    "Hi, this is Fairy calling on behalf of Maya and Daniel. I'd like to book a first fertility consult and check what records to bring. Do you have a moment?",
};

export interface PlaceCallResult {
  ok: boolean;
  callId: string | null;
  leg?: CallLeg;
  toNumber?: string;
  error?: string;
  detail?: string;
}

/** Dial the right AgentPhone number for this leg in webhook mode (Grok is the brain). */
export async function placeAgentPhoneCall(
  leg: CallLeg = "insurance",
): Promise<PlaceCallResult> {
  const config = resolveAgentPhoneConfig();
  if (!config) {
    return {
      ok: false,
      callId: null,
      error:
        "AgentPhone is not configured. Set AGENTPHONE_API_KEY, AGENTPHONE_AGENT_ID and AGENTPHONE_TO_NUMBER.",
    };
  }

  // Insurance dials the primary line; clinic dials the second line (falls back
  // to the primary if AGENTPHONE_TO_NUMBER2 is not set).
  const toNumber =
    leg === "clinic" ? config.toNumberClinic ?? config.toNumber : config.toNumber;

  // Webhook mode: agentId + toNumber + greeting, but NO systemPrompt.
  const body: Record<string, string> = {
    agentId: config.agentId,
    toNumber,
    initialGreeting: GREETINGS[leg],
  };
  if (config.fromNumberId) body.fromNumberId = config.fromNumberId;

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, callId: null, leg, error: `Network error: ${String(err)}` };
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      callId: null,
      leg,
      error: `AgentPhone call failed (${res.status})`,
      detail: text.slice(0, 400),
    };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // non-JSON success body — still treat as placed
  }

  const callId =
    (payload.id as string) ??
    (payload.call_id as string) ??
    (payload.callId as string) ??
    null;

  // Remember which leg this call is so the webhook uses the right Grok prompt
  // and only chains the clinic call after the INSURANCE call ends.
  if (callId) {
    await setCallType(callId, leg);
  }

  return { ok: true, callId, leg, toNumber };
}
