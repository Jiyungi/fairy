// ===========================================================================
// Live Grok chat adapter seam (lib/chat/live.ts) — Req 9, 15.2, 15.4, 15.5
//
// A thin, swappable seam for the real Grok (xAI) grounded-chat path. Mirrors
// lib/agent/live.ts: for the hackathon it makes NO real network call. It reports
// the live path as unavailable so the deterministic Mock_Fallback
// (answerCanonicalQuestion) answers every question (Req 15.5). The seam is kept
// clear so a real Grok chat-completion call can be dropped into
// `runLiveChatSession` later — the prompt would be built from the couple's data
// + Reference_Data and constrained to the fixed five-section format (Req 9.2).
// ===========================================================================

import { resolveGrokApiKey } from "@/lib/agent/live";
import { SEED_COUPLE_FIXTURE } from "@/lib/reference";

import {
  answerCanonicalQuestion,
  type CanonicalQuestionId,
  type ChatAnswer,
  type CoupleData,
} from "./grounded-chat";

/** Thrown when the live Grok chat path cannot be used; triggers Mock_Fallback. */
export class LiveChatUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveChatUnavailableError";
  }
}

/** True when a Grok key is configured (the live path MIGHT be attempted). */
export function isLiveChatConfigured(): boolean {
  return resolveGrokApiKey() !== null;
}

/**
 * SEAM: produce a grounded answer via the real Grok chat path.
 *
 * For the hackathon this never makes a network call — it always reports the live
 * path as unavailable so the caller falls back to the deterministic
 * answerCanonicalQuestion. Replace the body with a real Grok chat-completion
 * request to go live; the route wrapper and the pure engine are unchanged.
 */
export async function tryLiveChatAnswer(
  _questionId: CanonicalQuestionId,
  _coupleData: CoupleData = SEED_COUPLE_FIXTURE,
): Promise<ChatAnswer> {
  if (!isLiveChatConfigured()) {
    throw new LiveChatUnavailableError(
      "No XAI_API_KEY / GROK_API_KEY configured; using deterministic Mock_Fallback.",
    );
  }
  // Hackathon: do not place real network calls (Req 15.5 keeps the demo stable).
  throw new LiveChatUnavailableError(
    "Live Grok chat path is not enabled for the hackathon; using deterministic Mock_Fallback.",
  );
}

/**
 * Answer a canonical question, trying the live Grok path first and falling
 * through to the deterministic Mock_Fallback on any failure. This is the single
 * entry point the route handler calls.
 */
export async function answerCanonicalQuestionLiveOrMock(
  questionId: CanonicalQuestionId,
  coupleData: CoupleData = SEED_COUPLE_FIXTURE,
): Promise<{ answer: ChatAnswer; usedFallback: boolean }> {
  try {
    const answer = await tryLiveChatAnswer(questionId, coupleData);
    return { answer, usedFallback: false };
  } catch {
    return { answer: answerCanonicalQuestion(questionId, coupleData), usedFallback: true };
  }
}
