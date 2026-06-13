// ===========================================================================
// Live voice adapter seam (lib/agent/live.ts) — Req 6.4, 6.7, 15.2, 15.4, 15.5
//
// Resolution order:
//   1. Grok Voice Agent API (xAI sponsor — grok-voice-latest over WebSocket)
//   2. AgentPhone (opt-in only when USE_GROK_VOICE=false and USE_AGENTPHONE=true)
//   3. Throws LiveVoiceUnavailableError → Mock_Fallback in index.ts
//
// Transcripts are passed through lib/core/extract extractors (Req 6.4).
// ===========================================================================

import {
  isAgentPhoneEnabled,
  isGrokVoiceEnabled,
  resolveGrokApiKey,
} from "@/lib/config";
import {
  AgentPhoneUnavailableError,
  runAgentPhoneSession,
} from "@/lib/agent/agentphone";
import { runGrokVoiceSession } from "@/lib/agent/grok-voice";
import { LiveVoiceUnavailableError } from "@/lib/agent/errors";
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

export { LiveVoiceUnavailableError, resolveGrokApiKey };

export function isLiveVoiceConfigured(): boolean {
  return isGrokVoiceEnabled() || isAgentPhoneEnabled();
}

/**
 * Run a live voice session: Grok Voice first (sponsor), then optional AgentPhone.
 */
export async function runLiveVoiceSession(
  callType: CallType,
  packet: AuthPacket,
): Promise<Turn[]> {
  if (isGrokVoiceEnabled()) {
    return runGrokVoiceSession(callType, packet);
  }

  if (isAgentPhoneEnabled()) {
    try {
      return await runAgentPhoneSession(callType, packet);
    } catch (err) {
      if (err instanceof AgentPhoneUnavailableError) {
        throw new LiveVoiceUnavailableError(err.message);
      }
      throw err;
    }
  }

  throw new LiveVoiceUnavailableError(
    "No live voice path configured. Set XAI_API_KEY (Grok Voice) or USE_AGENTPHONE with AgentPhone env vars.",
  );
}

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
