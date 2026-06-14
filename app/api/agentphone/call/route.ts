// ===========================================================================
// Place a live AgentPhone call (app/api/agentphone/call/route.ts)
//
// Thin HTTP wrapper over placeAgentPhoneCall(). The PRIMARY trigger is agentic
// (intake submit fires the call automatically); this endpoint exists as a
// manual fallback / for testing. Dials AGENTPHONE_TO_NUMBER in webhook mode so
// Grok is the brain.
// ===========================================================================

import { placeAgentPhoneCall } from "@/lib/agent/place-call";

export const runtime = "nodejs";

export async function POST() {
  const result = await placeAgentPhoneCall();
  if (!result.ok) {
    const status = result.error?.startsWith("AgentPhone is not configured") ? 503 : 502;
    return Response.json(result, { status });
  }
  return Response.json({
    ok: true,
    callId: result.callId,
    toNumber: result.toNumber,
    mode: "webhook",
    message: `Calling ${result.toNumber} now — Grok is the brain.`,
  });
}
