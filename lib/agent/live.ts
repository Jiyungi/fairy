// ===========================================================================
// Live agentic call seam (lib/agent/live.ts) — Req 6.1–6.14, 15.2, 15.4, 15.5
//
// Resolution order for a LIVE call (the caller falls back to the deterministic
// Mock_Fallback only if ALL of these are unavailable / fail):
//   1. AgentPhone (when USE_AGENTPHONE=true and configured) — a real outbound
//      call placed via the AgentPhone REST API (Person C). Returns the live
//      human transcript as Turn[].
//   2. Grok Voice WebSocket (when XAI_VOICE_WS_URL + XAI_VOICE_MODEL + a key are
//      set) — a real-time spoken session where the agentic turn policy phrases
//      its own questions from the remaining Call_Objectives, listens to the live
//      human, skips answered objectives, and follows up on vague answers.
//
// Either way the structured result is extracted from the REAL transcript
// (Req 6.4–6.8) and returned with usedFallback:false, resultSource:"live".
// Guardrails (withhold member_id/DOB until verification asked; decline medical
// decisions) are enforced on the WebSocket path here and inside AgentPhone's
// prompt. This module is side-effect-free on import: no socket/network is
// opened until a call actually runs, and when nothing is configured every
// tryLive* throws LiveVoiceUnavailableError so the caller uses Mock_Fallback.
// ===========================================================================

import { isAgentPhoneEnabled, resolveGrokApiKey } from "@/lib/config";
import {
  extractClinicResult,
  extractInsuranceResult,
} from "@/lib/core/extract";
import {
  CLINIC_OBJECTIVES,
  CLINIC_AGENT_OPENING,
  INSURANCE_OBJECTIVES,
} from "@/lib/reference";
import type {
  AuthPacket,
  CallObjective,
  CallOutput,
  CallType,
  ClinicResult,
  InsuranceResult,
  LiveVoiceSession,
  Turn,
} from "@/lib/types";

import { AgentPhoneUnavailableError, runAgentPhoneSession } from "./agentphone";
import { formatDobSpoken } from "./mock-fallback";
import { nextQuestion, objectivesSatisfied } from "./turn-policy";

/** Thrown when no live path can be used; triggers the deterministic Mock_Fallback. */
export class LiveVoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveVoiceUnavailableError";
  }
}

/** Resolve the Grok API key: `XAI_API_KEY` first, then `GROK_API_KEY` (Req 15.4). */
export { resolveGrokApiKey };

/** True when SOME live path (a Grok key or AgentPhone) might be attempted. */
export function isLiveVoiceConfigured(): boolean {
  return resolveGrokApiKey() !== null || isAgentPhoneEnabled();
}

/** Resolve the live voice WebSocket config, or null when not fully configured. */
function resolveVoiceConfig(): { wsUrl: string; model: string; apiKey: string } | null {
  const apiKey = resolveGrokApiKey();
  const wsUrl = process.env.XAI_VOICE_WS_URL;
  const model = process.env.XAI_VOICE_MODEL;
  if (
    typeof apiKey === "string" &&
    apiKey.length > 0 &&
    typeof wsUrl === "string" &&
    wsUrl.trim().length > 0 &&
    typeof model === "string" &&
    model.trim().length > 0
  ) {
    return { wsUrl: wsUrl.trim(), model: model.trim(), apiKey };
  }
  return null;
}

/** True only when the full Grok Voice WebSocket path is configured. */
export function isLiveVoiceSessionConfigured(): boolean {
  return resolveVoiceConfig() !== null;
}

// ---------------------------------------------------------------------------
// WebSocket acquisition (lazy, guarded — never runs at import time)
// ---------------------------------------------------------------------------

type WebSocketCtor = new (url: string, ...args: unknown[]) => WebSocketLike;

interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (ev: unknown) => void): void;
}

async function resolveWebSocketCtor(): Promise<WebSocketCtor | null> {
  const globalWs = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof globalWs === "function") {
    return globalWs as unknown as WebSocketCtor;
  }
  try {
    const pkg = "ws";
    const mod = (await import(pkg)) as { default?: unknown } & Record<string, unknown>;
    const ctor = (mod.default ?? mod) as unknown;
    if (typeof ctor === "function") return ctor as WebSocketCtor;
  } catch {
    // `ws` not installed — fall through to null.
  }
  return null;
}

/**
 * Create a Grok Voice WebSocket session. Construction is side-effect-free: the
 * socket is opened only in connect(), and only when the voice env is fully set.
 */
export function createLiveVoiceSession(
  callType: CallType,
  packet: AuthPacket,
): LiveVoiceSession {
  let socket: WebSocketLike | null = null;
  const humanTurnHandlers: ((t: Turn) => void)[] = [];
  const partials: Turn[] = [];

  return {
    async connect(): Promise<void> {
      const config = resolveVoiceConfig();
      if (!config) {
        throw new LiveVoiceUnavailableError(
          "Grok Voice WebSocket env not configured (need XAI_VOICE_WS_URL, XAI_VOICE_MODEL, and a key).",
        );
      }
      const Ctor = await resolveWebSocketCtor();
      if (!Ctor) {
        throw new LiveVoiceUnavailableError(
          "No WebSocket implementation available (global WebSocket or `ws`).",
        );
      }
      const url = `${config.wsUrl}?model=${encodeURIComponent(config.model)}&call=${encodeURIComponent(callType)}`;
      await new Promise<void>((resolve, reject) => {
        let ws: WebSocketLike;
        try {
          ws = new Ctor(url, { headers: { Authorization: `Bearer ${config.apiKey}` } });
        } catch (err) {
          reject(
            new LiveVoiceUnavailableError(
              `Failed to open Grok Voice WebSocket: ${(err as Error).message}`,
            ),
          );
          return;
        }
        socket = ws;
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () =>
          reject(new LiveVoiceUnavailableError("Grok Voice WebSocket error during connect.")),
        );
        ws.addEventListener("close", () => {
          socket = null;
        });
        ws.addEventListener("message", (ev: unknown) => {
          const turn = parseHumanTurn(ev);
          if (turn) {
            partials.push(turn);
            for (const cb of humanTurnHandlers) cb(turn);
          }
        });
      });
    },
    async speak(prompt: string): Promise<void> {
      if (!socket) throw new LiveVoiceUnavailableError("Grok Voice session is not connected.");
      partials.push({ speaker: "agent", text: prompt });
      socket.send(JSON.stringify({ type: "speak", text: prompt, member: packet.couple_id }));
    },
    onHumanTurn(cb: (t: Turn) => void): void {
      humanTurnHandlers.push(cb);
    },
    partialTranscript(): Turn[] {
      return [...partials];
    },
    async close(): Promise<void> {
      if (socket) {
        socket.close();
        socket = null;
      }
    },
  };
}

/** Parse a transcribed human (responder) turn from a raw WebSocket message. */
function parseHumanTurn(ev: unknown): Turn | null {
  const data = (ev as { data?: unknown })?.data;
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as { type?: string; text?: unknown };
    if (
      (parsed.type === "human" || parsed.type === "transcript") &&
      typeof parsed.text === "string" &&
      parsed.text.trim().length > 0
    ) {
      return { speaker: "responder", text: parsed.text };
    }
  } catch {
    // Non-JSON frame — ignore.
  }
  return null;
}

// ---------------------------------------------------------------------------
// Agentic WebSocket loop guardrails (Req 6.10, 6.11)
// ---------------------------------------------------------------------------

const VERIFY_REQUEST_MARKERS = [
  "verify", "verification", "member id", "member i.d.", "date of birth", "dob",
  "confirm the member",
];
const MEDICAL_REQUEST_MARKERS = [
  "approve", "accept", "treatment", "commit", "protocol", "medical decision",
  "start an ", "go ahead and",
];

type ResponderIntent = "verify_request" | "medical_request" | "answer";

function classifyResponder(text: string): ResponderIntent {
  const lc = text.toLowerCase();
  if (VERIFY_REQUEST_MARKERS.some((m) => lc.includes(m))) return "verify_request";
  if (MEDICAL_REQUEST_MARKERS.some((m) => lc.includes(m))) return "medical_request";
  return "answer";
}

const MAX_AGENT_TURNS = 40;

/** Run the agentic speak/listen loop over a Grok Voice WebSocket session. */
async function runWebSocketCall(
  callType: CallType,
  packet: AuthPacket,
  objectives: CallObjective[],
  opening: string,
): Promise<Turn[]> {
  const session = createLiveVoiceSession(callType, packet);
  await session.connect();

  const transcript: Turn[] = [];
  const queue: Turn[] = [];
  let waiter: ((t: Turn) => void) | null = null;
  session.onHumanTurn((t) => {
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(t);
    } else {
      queue.push(t);
    }
  });
  const waitForHuman = (): Promise<Turn> =>
    new Promise<Turn>((resolve) => {
      const queued = queue.shift();
      if (queued) resolve(queued);
      else waiter = resolve;
    });

  try {
    transcript.push({ speaker: "agent", text: opening });
    await session.speak(opening);

    let agentTurns = 1;
    while (agentTurns < MAX_AGENT_TURNS) {
      const answered = objectivesSatisfied(objectives, transcript);
      if (answered.size >= objectives.length) break;

      const lastAnswer = [...transcript].reverse().find((t) => t.speaker === "responder");
      const q = nextQuestion(objectives, answered, { couple: packet, lastAnswer });
      if (!q) break;

      transcript.push({ speaker: "agent", text: q.phrasing });
      await session.speak(q.phrasing);
      agentTurns++;

      const human = await waitForHuman();
      transcript.push(human);

      const intent = classifyResponder(human.text);
      if (intent === "verify_request") {
        const disclosure =
          `Thank you. For verification: the member ID is ${packet.member_id}, ` +
          `and the policy holder's date of birth is ${formatDobSpoken(packet.dob)}.`;
        transcript.push({ speaker: "agent", text: disclosure });
        await session.speak(disclosure);
        agentTurns++;
      } else if (intent === "medical_request") {
        const decline =
          "I'm not able to make medical decisions or accept treatment on the " +
          "couple's behalf. I'll note this as a follow-up task for them to " +
          "decide with their clinician.";
        transcript.push({ speaker: "agent", text: decline });
        await session.speak(decline);
        agentTurns++;
      }
    }
    return transcript;
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Unified live transcript: AgentPhone first, then Grok Voice WebSocket
// ---------------------------------------------------------------------------

/**
 * Obtain a live human transcript for a call, trying AgentPhone first (real
 * outbound call) and then the Grok Voice WebSocket agentic session. Throws
 * LiveVoiceUnavailableError when neither path is available/usable so the caller
 * falls back to the deterministic Mock_Fallback.
 */
async function getLiveTranscript(
  callType: CallType,
  packet: AuthPacket,
  objectives: CallObjective[],
  opening: string,
): Promise<Turn[]> {
  // 1. AgentPhone (Person C) — a real outbound call.
  if (isAgentPhoneEnabled()) {
    try {
      return await runAgentPhoneSession(callType, packet);
    } catch (err) {
      if (!(err instanceof AgentPhoneUnavailableError)) {
        throw new LiveVoiceUnavailableError(
          `AgentPhone call failed: ${(err as Error).message}`,
        );
      }
      // AgentPhone unavailable — fall through to the Grok Voice WebSocket.
    }
  }

  // 2. Grok Voice WebSocket agentic session.
  if (isLiveVoiceSessionConfigured()) {
    return runWebSocketCall(callType, packet, objectives, opening);
  }

  throw new LiveVoiceUnavailableError(
    "No live call path available (AgentPhone disabled and Grok Voice WebSocket not configured).",
  );
}

/**
 * SEAM kept for compatibility: returns a live transcript for a call type.
 * AgentPhone-first, then the Grok Voice WebSocket agentic session.
 */
export async function runLiveVoiceSession(
  callType: CallType,
  packet: AuthPacket,
): Promise<Turn[]> {
  const objectives = callType === "insurance" ? INSURANCE_OBJECTIVES : CLINIC_OBJECTIVES;
  const opening =
    callType === "insurance" ? buildInsuranceOpening(packet) : CLINIC_AGENT_OPENING;
  return getLiveTranscript(callType, packet, objectives, opening);
}

// ---------------------------------------------------------------------------
// Public live-call entry points (throw to fall back to Mock_Fallback)
// ---------------------------------------------------------------------------

export async function tryLiveInsuranceCall(
  packet: AuthPacket,
): Promise<CallOutput<InsuranceResult>> {
  try {
    const transcript = await getLiveTranscript(
      "insurance",
      packet,
      INSURANCE_OBJECTIVES,
      buildInsuranceOpening(packet),
    );
    const outcome = extractInsuranceResult(transcript);
    return {
      transcript,
      transcriptStream: transcript,
      result: outcome.result as InsuranceResult,
      unresolvedFields: outcome.unresolved,
      usedFallback: false,
      resultSource: "live",
    };
  } catch (err) {
    if (err instanceof LiveVoiceUnavailableError) throw err;
    throw new LiveVoiceUnavailableError(`Live insurance call failed: ${(err as Error).message}`);
  }
}

export async function tryLiveClinicCall(
  packet: AuthPacket,
): Promise<CallOutput<ClinicResult>> {
  try {
    const transcript = await getLiveTranscript(
      "clinic",
      packet,
      CLINIC_OBJECTIVES,
      CLINIC_AGENT_OPENING,
    );
    const outcome = extractClinicResult(transcript);
    return {
      transcript,
      transcriptStream: transcript,
      result: outcome.result as ClinicResult,
      unresolvedFields: outcome.unresolved,
      usedFallback: false,
      resultSource: "live",
    };
  } catch (err) {
    if (err instanceof LiveVoiceUnavailableError) throw err;
    throw new LiveVoiceUnavailableError(`Live clinic call failed: ${(err as Error).message}`);
  }
}

/** Guardrail-safe insurance opening (NO member_id / dob — Req 6.10). */
function buildInsuranceOpening(packet: AuthPacket): string {
  return (
    "Hi, I'm Fairy, an authorized assistant calling on behalf of a member to " +
    `verify fertility benefits under ${packet.provider}. ` +
    "Can I ask a few coverage questions?"
  );
}
