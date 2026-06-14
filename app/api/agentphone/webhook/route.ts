// ===========================================================================
// AgentPhone webhook (app/api/agentphone/webhook/route.ts)
//
// AgentPhone runs the call in WEBHOOK mode and POSTs here on every turn:
//   • agent.message (voice)  -> we ask Grok for the next line and return {text}
//   • agent.call_ended       -> we extract the structured result from the real
//                               transcript and persist it (advances the loop)
//
// Grok is the agentic brain (lib/agent/grok-brain). HMAC-verified per AgentPhone
// docs (signed string = `${timestamp}.${rawBody}`, header X-Webhook-Signature).
// ===========================================================================

import crypto from "node:crypto";

import { nextAgentLine, type BrainTurn } from "@/lib/agent/grok-brain";
import { extractClinicResult, extractInsuranceResult } from "@/lib/core/extract";
import { saveCallRecord, saveCalendarEvent, saveTasks } from "@/lib/db";
import type { ClinicResult, InsuranceResult, Turn } from "@/lib/types";

export const runtime = "nodejs";

const DEMO_COUPLE_ID = "couple_001";

interface VoiceMessageData {
  callId?: string;
  transcript?: string;
  status?: string;
}
interface RecentHistoryItem {
  content?: string;
  direction?: "inbound" | "outbound";
}
interface CallEndedData {
  callId?: string;
  transcript?: { role?: string; content?: string }[];
}
interface WebhookBody {
  event?: string;
  channel?: string;
  data?: VoiceMessageData & CallEndedData;
  recentHistory?: RecentHistoryItem[];
}

/** Verify the AgentPhone HMAC signature when a secret is configured. */
function verifySignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.AGENTPHONE_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // not configured yet — accept (demo-friendly)
  if (!signature || !timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expected}`),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const ok = verifySignature(
    rawBody,
    request.headers.get("x-webhook-signature"),
    request.headers.get("x-webhook-timestamp"),
  );
  if (!ok) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return new Response("OK", { status: 200 });
  }

  // --- A voice call ended: extract from the REAL transcript + persist --------
  if (body.event === "agent.call_ended") {
    try {
      await persistCallResult(body.data?.transcript ?? [], body.data?.callId ?? "live");
    } catch {
      // best-effort; never block the ack
    }
    return new Response("OK", { status: 200 });
  }

  // --- Non-voice (SMS) or non-message events: just acknowledge ---------------
  if (body.channel !== "voice" || body.event !== "agent.message") {
    return new Response("OK", { status: 200 });
  }

  // --- A live voice turn: Grok decides what the Fairy agent says next ---------
  const history: BrainTurn[] = (body.recentHistory ?? []).map((h) => ({
    role: h.direction === "outbound" ? "agent" : "user",
    content: h.content ?? "",
  }));
  const callerText = body.data?.transcript ?? "";

  let reply;
  try {
    reply = await nextAgentLine(history, callerText);
  } catch {
    reply = { text: "Sorry, could you repeat that?", done: false };
  }

  return new Response(
    JSON.stringify(reply.done ? { text: reply.text, hangup: true } : { text: reply.text }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Map the AgentPhone end-of-call transcript to Turn[] and persist results. */
async function persistCallResult(
  transcript: { role?: string; content?: string }[],
  callId: string,
): Promise<void> {
  const turns: Turn[] = transcript
    .filter((t) => typeof t.content === "string" && t.content.trim())
    .map((t) => ({
      speaker: t.role === "agent" ? "agent" : "responder",
      text: (t.content ?? "").trim(),
    }));

  const insurance = extractInsuranceResult(turns);
  const clinic = extractClinicResult(turns);

  // Always record the real call (transcript + whatever was extracted).
  await saveCallRecord({
    id: `call_${DEMO_COUPLE_ID}_${callId}`,
    couple_id: DEMO_COUPLE_ID,
    call_type: clinic.result.booked ? "clinic" : "insurance",
    transcript: turns,
    extracted_result: (clinic.result.booked
      ? (clinic.result as ClinicResult)
      : (insurance.result as InsuranceResult)),
    used_fallback: false,
    unresolved_fields: [...insurance.unresolved, ...clinic.unresolved],
  });

  // If the live call produced a booking, write the consult + prep tasks.
  if (clinic.result.booked && clinic.result.calendar_event && clinic.result.tasks) {
    const booked = clinic.result.booked;
    await saveCalendarEvent({
      id: `event_${DEMO_COUPLE_ID}_consult`,
      couple_id: DEMO_COUPLE_ID,
      type: clinic.result.calendar_event.type,
      title: `Fertility consult — ${booked.clinic}`,
      date: clinic.result.calendar_event.date,
      time: clinic.result.calendar_event.time,
      description: `${booked.mode} consult at ${booked.clinic}.`,
    });
    const tasks = clinic.followUpTasks.map((t, i) => ({
      id: `task_${DEMO_COUPLE_ID}_live_${i}`,
      couple_id: DEMO_COUPLE_ID,
      column: t.column,
      title: t.title,
      completed: false,
      weight: t.column === "him" ? 5 : 0,
      source_call_record_id: `call_${DEMO_COUPLE_ID}_${callId}`,
    }));
    if (tasks.length > 0) await saveTasks(DEMO_COUPLE_ID, tasks);
  }
}
