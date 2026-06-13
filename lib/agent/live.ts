// ===========================================================================
// Live agentic Grok Voice session (lib/agent/live.ts) — Req 6.1–6.14, 15.2, 15.4, 15.5
//
// The REAL Live_Voice_Session seam. `createLiveVoiceSession` opens a WebSocket
// to the Grok Voice endpoint (configured by `XAI_VOICE_WS_URL` /
// `XAI_VOICE_MODEL` + a resolved API key), speaks the agent's OWN phrasing, and
// receives transcribed human (responder) turns in real time (Req 6.1).
//
// tryLiveInsuranceCall / tryLiveClinicCall run the agentic loop: the turn policy
// picks the next unmet Call_Objective, the agent speaks it, the live human
// answers, the answer is appended, and the loop repeats until every objective
// is satisfied (Req 6.2, 6.3). Guardrails are enforced live: the member ID / DOB
// are withheld until the human requests identity verification (Req 6.10), and a
// request for a medical decision is declined and converted to a follow-up task
// (Req 6.11). The structured result is then extracted from the REAL transcript
// (Req 6.4–6.8) and returned with `usedFallback: false`, `resultSource: "live"`.
//
// IMPORTANT — safety / determinism:
//   * This module is side-effect-free on import: NO WebSocket is constructed and
//     NO network call is made at import time.
//   * When the live voice env is NOT configured (the case in tests and the
//     default demo), `connect()` throws `LiveVoiceUnavailableError`, so every
//     `tryLive*` call throws and the caller (lib/agent/index.ts) falls through
//     to the deterministic Mock_Fallback. No network call is ever attempted
//     without `XAI_VOICE_WS_URL`, `XAI_VOICE_MODEL`, and an API key all set.
// ===========================================================================

import { resolveGrokApiKey } from "@/lib/config";
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

import { formatDobSpoken } from "./mock-fallback";
import { nextQuestion, objectivesSatisfied } from "./turn-policy";

/** Thrown when the live Grok Voice path cannot be used; triggers Mock_Fallback. */
export class LiveVoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveVoiceUnavailableError";
  }
}

/**
 * Resolve the Grok API key: `XAI_API_KEY` first, then `GROK_API_KEY` (Req 15.4).
 * Re-exported from the canonical implementation in `lib/config.ts`.
 */
export { resolveGrokApiKey };

/** True when a Grok key is configured (the live path MIGHT be attempted). */
export function isLiveVoiceConfigured(): boolean {
  return resolveGrokApiKey() !== null;
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

/** True only when the full Live_Voice_Session WebSocket path is configured. */
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

/**
 * Resolve a WebSocket constructor: the global `WebSocket` (browser / modern
 * Node) when present, otherwise the optional `ws` package. Returns null when
 * neither is available. Never throws.
 */
async function resolveWebSocketCtor(): Promise<WebSocketCtor | null> {
  const globalWs = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof globalWs === "function") {
    return globalWs as unknown as WebSocketCtor;
  }
  try {
    // Non-literal specifier so the optional dependency is not statically
    // resolved/bundled and missing-module type errors are avoided.
    const pkg = "ws";
    const mod = (await import(pkg)) as { default?: unknown } & Record<string, unknown>;
    const ctor = (mod.default ?? mod) as unknown;
    if (typeof ctor === "function") return ctor as WebSocketCtor;
  } catch {
    // `ws` not installed — fall through to null.
  }
  return null;
}

// ---------------------------------------------------------------------------
// createLiveVoiceSession — the real WebSocket seam
// ---------------------------------------------------------------------------

/**
 * Create a Live_Voice_Session for a call. Construction is side-effect-free: the
 * WebSocket is opened only in `connect()`, and ONLY when the live voice env is
 * fully configured. When it is not configured, `connect()` throws
 * `LiveVoiceUnavailableError` so the caller falls back to the Mock_Fallback.
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
          "Live voice env not configured (need XAI_VOICE_WS_URL, XAI_VOICE_MODEL, and a Grok key); using deterministic Mock_Fallback.",
        );
      }

      const Ctor = await resolveWebSocketCtor();
      if (!Ctor) {
        throw new LiveVoiceUnavailableError(
          "No WebSocket implementation available (global WebSocket or `ws`); using deterministic Mock_Fallback.",
        );
      }

      const url = `${config.wsUrl}?model=${encodeURIComponent(config.model)}&call=${encodeURIComponent(callType)}`;

      await new Promise<void>((resolve, reject) => {
        let ws: WebSocketLike;
        try {
          ws = new Ctor(url, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
          });
        } catch (err) {
          reject(
            new LiveVoiceUnavailableError(
              `Failed to open live voice WebSocket: ${(err as Error).message}`,
            ),
          );
          return;
        }

        socket = ws;

        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () =>
          reject(
            new LiveVoiceUnavailableError("Live voice WebSocket error during connect."),
          ),
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
      if (!socket) {
        throw new LiveVoiceUnavailableError("Live voice session is not connected.");
      }
      partials.push({ speaker: "agent", text: prompt });
      socket.send(
        JSON.stringify({ type: "speak", text: prompt, member: packet.couple_id }),
      );
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
// Agentic loop guardrails (Req 6.10, 6.11)
// ---------------------------------------------------------------------------

type ResponderIntent = "verify_request" | "medical_request" | "answer";

const VERIFY_REQUEST_MARKERS = [
  "verify",
  "verification",
  "member id",
  "member i.d.",
  "date of birth",
  "dob",
  "confirm the member",
];

const MEDICAL_REQUEST_MARKERS = [
  "approve",
  "accept",
  "treatment",
  "commit",
  "protocol",
  "medical decision",
  "start an ",
  "go ahead and",
];

/** Classify a live human turn so the agent can apply the call guardrails. */
function classifyResponder(text: string): ResponderIntent {
  const lc = text.toLowerCase();
  if (VERIFY_REQUEST_MARKERS.some((m) => lc.includes(m))) return "verify_request";
  if (MEDICAL_REQUEST_MARKERS.some((m) => lc.includes(m))) return "medical_request";
  return "answer";
}

const MAX_AGENT_TURNS = 40;

interface LiveLoopResult {
  transcript: Turn[];
  transcriptStream: Turn[];
  medicalDeclineTasks: string[];
}

/**
 * Run the agentic speak→listen loop over a Live_Voice_Session until every
 * objective is satisfied (or the max-turns guard trips). Returns the real
 * chronological agent/responder transcript plus the streamed partials.
 */
async function runLiveCall(
  callType: CallType,
  packet: AuthPacket,
  objectives: CallObjective[],
  opening: string,
): Promise<LiveLoopResult> {
  const session = createLiveVoiceSession(callType, packet);
  await session.connect();

  const transcript: Turn[] = [];
  const medicalDeclineTasks: string[] = [];

  // Bridge the callback-based onHumanTurn into an awaitable next-turn promise.
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
    // The agent opens the call (PII-free — member ID / DOB withheld, Req 6.10).
    transcript.push({ speaker: "agent", text: opening });
    await session.speak(opening);

    let agentTurns = 1;
    while (agentTurns < MAX_AGENT_TURNS) {
      const answered = objectivesSatisfied(objectives, transcript);
      if (answered.size >= objectives.length) break;

      const lastAnswer = [...transcript]
        .reverse()
        .find((t) => t.speaker === "responder");

      const q = nextQuestion(objectives, answered, {
        couple: packet,
        lastAnswer,
      });
      if (!q) break;

      transcript.push({ speaker: "agent", text: q.phrasing });
      await session.speak(q.phrasing);
      agentTurns++;

      const human = await waitForHuman();
      transcript.push(human);

      // Apply guardrails to the live human turn.
      const intent = classifyResponder(human.text);
      if (intent === "verify_request") {
        // The ONLY agent turn that may contain member ID / DOB, and only AFTER
        // the human requests verification (Req 6.10).
        const disclosure =
          `Thank you. For verification: the member ID is ${packet.member_id}, ` +
          `and the policy holder's date of birth is ${formatDobSpoken(packet.dob)}.`;
        transcript.push({ speaker: "agent", text: disclosure });
        await session.speak(disclosure);
        agentTurns++;
      } else if (intent === "medical_request") {
        // Never accept treatment on the couple's behalf; decline + add a task
        // (Req 6.11).
        const decline =
          "I'm not able to make medical decisions or accept treatment on the " +
          "couple's behalf. I'll note this as a follow-up task for them to " +
          "decide with their clinician.";
        transcript.push({ speaker: "agent", text: decline });
        await session.speak(decline);
        agentTurns++;
        medicalDeclineTasks.push(
          `Couple to decide with their clinician: ${human.text}`,
        );
      }
    }

    const transcriptStream = session.partialTranscript();
    return { transcript, transcriptStream, medicalDeclineTasks };
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Public live-call entry points (throw LiveVoiceUnavailableError to fall back)
// ---------------------------------------------------------------------------

/**
 * Attempt the live insurance call. Opens the Live_Voice_Session, satisfies the
 * 10 insurance Call_Objectives via the agentic loop, then extracts the
 * structured InsuranceResult from the REAL transcript (Req 6.4, 6.6, 6.7).
 * Throws LiveVoiceUnavailableError on any failure/unavailability so the caller
 * falls back to the deterministic Mock_Fallback.
 */
export async function tryLiveInsuranceCall(
  packet: AuthPacket,
): Promise<CallOutput<InsuranceResult>> {
  try {
    const { transcript, transcriptStream } = await runLiveCall(
      "insurance",
      packet,
      INSURANCE_OBJECTIVES,
      buildInsuranceOpening(packet),
    );

    const outcome = extractInsuranceResult(transcript);
    return {
      transcript,
      transcriptStream,
      result: outcome.result as InsuranceResult,
      unresolvedFields: outcome.unresolved,
      usedFallback: false,
      resultSource: "live",
    };
  } catch (err) {
    if (err instanceof LiveVoiceUnavailableError) throw err;
    throw new LiveVoiceUnavailableError(
      `Live insurance call failed: ${(err as Error).message}`,
    );
  }
}

/**
 * Attempt the live clinic call. Opens the Live_Voice_Session, satisfies the 7
 * clinic Call_Objectives via the agentic loop, then extracts the structured
 * ClinicResult from the REAL transcript (Req 6.5, 6.6, 6.7). Throws
 * LiveVoiceUnavailableError on any failure/unavailability so the caller falls
 * back to the deterministic Mock_Fallback.
 */
export async function tryLiveClinicCall(
  packet: AuthPacket,
): Promise<CallOutput<ClinicResult>> {
  try {
    const { transcript, transcriptStream } = await runLiveCall(
      "clinic",
      packet,
      CLINIC_OBJECTIVES,
      CLINIC_AGENT_OPENING,
    );

    const outcome = extractClinicResult(transcript);
    return {
      transcript,
      transcriptStream,
      result: outcome.result as ClinicResult,
      unresolvedFields: outcome.unresolved,
      usedFallback: false,
      resultSource: "live",
    };
  } catch (err) {
    if (err instanceof LiveVoiceUnavailableError) throw err;
    throw new LiveVoiceUnavailableError(
      `Live clinic call failed: ${(err as Error).message}`,
    );
  }
}

/**
 * Build a guardrail-safe insurance opening (NO member_id / dob — Req 6.10).
 * The provider comes from the authorization packet so the agent phrases its own
 * opening rather than reading a verbatim script.
 */
function buildInsuranceOpening(packet: AuthPacket): string {
  return (
    "Hi, I'm Fairy, an authorized assistant calling on behalf of a member to " +
    `verify fertility benefits under ${packet.provider}. ` +
    "Can I ask a few coverage questions?"
  );
}
