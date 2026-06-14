// ===========================================================================
// Place a live AgentPhone call (lib/agent/place-call.ts)
//
// Shared helper that dials AGENTPHONE_TO_NUMBER via AgentPhone in WEBHOOK mode.
// We deliberately DO NOT send a systemPrompt — omitting it keeps the call in
// webhook mode, so AgentPhone POSTs every turn to /api/agentphone/webhook and
// GROK is the conversational brain.
//
// Calls ALWAYS go to AGENTPHONE_TO_NUMBER only (from resolveAgentPhoneConfig).
// Used agentically by the intake flow (call fires when data is submitted) and
// reachable directly via /api/agentphone/call.
// ===========================================================================

import { resolveAgentPhoneConfig } from "@/lib/config";

const INITIAL_GREETING =
  "Hi, this is Fairy calling on behalf of Maya and Daniel. I'm helping them verify their fertility benefits and book a first consult. Do you have a moment?";

export interface PlaceCallResult {
  ok: boolean;
  callId: string | null;
  toNumber?: string;
  error?: string;
  detail?: string;
}

/** Dial AGENTPHONE_TO_NUMBER in webhook mode (Grok is the brain). */
export async function placeAgentPhoneCall(): Promise<PlaceCallResult> {
  const config = resolveAgentPhoneConfig();
  if (!config) {
    return {
      ok: false,
      callId: null,
      error:
        "AgentPhone is not configured. Set AGENTPHONE_API_KEY, AGENTPHONE_AGENT_ID and AGENTPHONE_TO_NUMBER.",
    };
  }

  // Webhook mode: agentId + toNumber + greeting, but NO systemPrompt.
  const body: Record<string, string> = {
    agentId: config.agentId,
    toNumber: config.toNumber,
    initialGreeting: INITIAL_GREETING,
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
    return { ok: false, callId: null, error: `Network error: ${String(err)}` };
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      callId: null,
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

  return { ok: true, callId, toNumber: config.toNumber };
}
