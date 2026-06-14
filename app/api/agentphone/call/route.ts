// ===========================================================================
// Place a live AgentPhone call (app/api/agentphone/call/route.ts)
//
// POST here (from the "Call me now" button) to make AgentPhone dial the demo
// number (AGENTPHONE_TO_NUMBER) in WEBHOOK mode. We deliberately DO NOT send a
// systemPrompt — omitting it keeps the call in webhook mode, so AgentPhone POSTs
// every turn to /api/agentphone/webhook and GROK is the conversational brain.
//
// Calls ALWAYS go to AGENTPHONE_TO_NUMBER only (from resolveAgentPhoneConfig).
// ===========================================================================

import { resolveAgentPhoneConfig } from "@/lib/config";

export const runtime = "nodejs";

const INITIAL_GREETING =
  "Hi, this is Fairy calling on behalf of Maya and Daniel. I'm helping them verify their fertility benefits and book a first consult. Do you have a moment?";

export async function POST() {
  const config = resolveAgentPhoneConfig();
  if (!config) {
    return Response.json(
      {
        error:
          "AgentPhone is not configured. Set AGENTPHONE_API_KEY, AGENTPHONE_AGENT_ID and AGENTPHONE_TO_NUMBER.",
      },
      { status: 503 },
    );
  }

  // Webhook mode: agentId + toNumber + greeting, but NO systemPrompt.
  const body: Record<string, string> = {
    agentId: config.agentId,
    toNumber: config.toNumber,
    initialGreeting: INITIAL_GREETING,
  };
  if (config.fromNumberId) body.fromNumberId = config.fromNumberId;

  const res = await fetch(`${config.baseUrl}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    return Response.json(
      { error: `AgentPhone call failed (${res.status})`, detail: text.slice(0, 400) },
      { status: 502 },
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // non-JSON success body — still treat as placed
  }

  const callId = payload.id ?? payload.call_id ?? payload.callId ?? null;
  return Response.json({
    ok: true,
    callId,
    toNumber: config.toNumber,
    mode: "webhook",
    message: `Calling ${config.toNumber} now — Grok is the brain.`,
  });
}
