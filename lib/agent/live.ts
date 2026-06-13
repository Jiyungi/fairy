// ===========================================================================
// Live Grok Voice adapter seam (lib/agent/live.ts) — Req 6.4, 6.7, 15.2, 15.4, 15.5
//
// A thin, swappable seam for the real Grok Voice Agent path. For the hackathon
// it makes NO real network calls (Req 15.6 — no Twilio / real telephony / PHI):
// it reports the live path as unavailable so the deterministic Mock_Fallback
// runs every time (usedFallback = true). The seam is kept clear so a real
// Grok Voice implementation can be dropped into `runLiveVoiceSession` later.
//
// When a live transcript IS produced, the structured result is derived through
// the lib/core/extract extractors (Req 6.4): unresolved fields are isolated and
// converted to follow-up tasks (Property 16). If extraction is incomplete the
// session is treated as a failure so the caller falls through to Mock_Fallback
// (Req 6.7).
// ===========================================================================

import { resolveGrokApiKey } from "@/lib/config";
import {
  extractClinicResult,
  extractInsuranceResult,
} from "@/lib/core/extract";
import type {
  AuthPacket,
  CallOutput,
  CallType,
  ClinicResult,
  InsuranceResult,
  Turn,
} from "@/lib/types";

/** Thrown when the live Grok Voice path cannot be used; triggers Mock_Fallback. */
export class LiveVoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveVoiceUnavailableError";
  }
}

/**
 * Resolve the Grok API key: `XAI_API_KEY` first, then `GROK_API_KEY` (Req 15.4).
 * Returns null when neither is set.
 *
 * Re-exported from the canonical implementation in `lib/config.ts` so existing
 * importers of `@/lib/agent/live` keep working without duplicating the logic.
 */
export { resolveGrokApiKey };

/** True when a Grok key is configured (the live path MIGHT be attempted). */
export function isLiveVoiceConfigured(): boolean {
  return resolveGrokApiKey() !== null;
}

/**
 * SEAM: perform a real Grok Voice session and return its transcript.
 *
 * For the hackathon this never makes a network call — it always reports the
 * live path as unavailable so the Mock_Fallback runs. Replace the body with a
 * real Grok Voice Agent session to go live; the rest of the agent layer is
 * unchanged.
 */
export async function runLiveVoiceSession(
  _callType: CallType,
  _packet: AuthPacket,
): Promise<Turn[]> {
  if (!isLiveVoiceConfigured()) {
    throw new LiveVoiceUnavailableError(
      "No XAI_API_KEY / GROK_API_KEY configured; using deterministic Mock_Fallback.",
    );
  }
  // Hackathon: do not place real calls / telephony (Req 15.6).
  throw new LiveVoiceUnavailableError(
    "Live Grok Voice path is not enabled for the hackathon; using deterministic Mock_Fallback.",
  );
}

/**
 * Attempt the live insurance call. Throws LiveVoiceUnavailableError on any
 * failure or incomplete extraction so the caller falls back to the mock.
 */
export async function tryLiveInsuranceCall(
  packet: AuthPacket,
): Promise<CallOutput<InsuranceResult>> {
  const transcript = await runLiveVoiceSession("insurance", packet);
  const outcome = extractInsuranceResult(transcript);
  if (outcome.unresolved.length > 0) {
    throw new LiveVoiceUnavailableError(
      `Live insurance extraction incomplete: ${outcome.unresolved.join(", ")}`,
    );
  }
  return {
    transcript,
    result: outcome.result as InsuranceResult,
    usedFallback: false,
  };
}

/**
 * Attempt the live clinic call. Throws LiveVoiceUnavailableError on any failure
 * or incomplete extraction so the caller falls back to the mock.
 */
export async function tryLiveClinicCall(
  packet: AuthPacket,
): Promise<CallOutput<ClinicResult>> {
  const transcript = await runLiveVoiceSession("clinic", packet);
  const outcome = extractClinicResult(transcript);
  if (outcome.unresolved.length > 0) {
    throw new LiveVoiceUnavailableError(
      `Live clinic extraction incomplete: ${outcome.unresolved.join(", ")}`,
    );
  }
  return {
    transcript,
    result: outcome.result as ClinicResult,
    usedFallback: false,
  };
}
