// ===========================================================================
// One-time AgentPhone webhook setup (app/api/agentphone/setup/route.ts)
//
// POST here ONCE (after deploy) to:
//   1. Switch the agent to webhook voice mode  -> PATCH /v1/agents/{agentId}
//      { voiceMode: "webhook" }  so Grok (our webhook) drives the conversation.
//   2. Register the project webhook            -> POST  /v1/webhooks
//      { url: <origin>/api/agentphone/webhook, contextLimit }
//      and return the `secret`.
//
// Copy the returned `secret` into AGENTPHONE_WEBHOOK_SECRET (env) so the webhook
// can HMAC-verify AgentPhone's requests.
// ===========================================================================

import { resolveAgentPhoneConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  const authHeaders = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  // The public origin AgentPhone will call back. Honor an explicit override so
  // this works from localhost via a tunnel (set AGENTPHONE_WEBHOOK_URL).
  const origin =
    process.env.AGENTPHONE_WEBHOOK_URL?.trim() ||
    new URL(request.url).origin;
  const webhookUrl = process.env.AGENTPHONE_WEBHOOK_URL?.trim()
    ? origin
    : `${origin}/api/agentphone/webhook`;

  // 1) Put the agent in webhook voice mode (Grok becomes the brain).
  const patchRes = await fetch(`${config.baseUrl}/agents/${config.agentId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ voiceMode: "webhook" }),
  });
  const patchText = await patchRes.text();
  if (!patchRes.ok) {
    return Response.json(
      {
        step: "set-voice-mode",
        error: `PATCH agent failed (${patchRes.status})`,
        detail: patchText.slice(0, 400),
      },
      { status: 502 },
    );
  }

  // 2) Register the project webhook; capture the signing secret.
  const hookRes = await fetch(`${config.baseUrl}/webhooks`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ url: webhookUrl, contextLimit: 20 }),
  });
  const hookText = await hookRes.text();
  if (!hookRes.ok) {
    return Response.json(
      {
        step: "register-webhook",
        error: `POST webhook failed (${hookRes.status})`,
        detail: hookText.slice(0, 400),
      },
      { status: 502 },
    );
  }

  let hook: Record<string, unknown> = {};
  try {
    hook = JSON.parse(hookText) as Record<string, unknown>;
  } catch {
    // ignore — return raw below
  }

  const secret = hook.secret ?? hook.signingSecret ?? null;
  return Response.json({
    ok: true,
    voiceMode: "webhook",
    webhookUrl,
    secret,
    next: secret
      ? "Copy `secret` into AGENTPHONE_WEBHOOK_SECRET (env) and redeploy."
      : "Webhook registered. Check AgentPhone dashboard for the signing secret.",
    raw: hook,
  });
}
