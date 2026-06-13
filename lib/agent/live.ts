// ===========================================================================
// Live voice adapter seam (lib/agent/live.ts) — Req 6.4, 6.7, 15.2, 15.4, 15.5
//
// Resolution order:
//   1. AgentPhone (when USE_AGENTPHONE=true and configured)
//   2. Grok Voice (when configured — stub for hackathon)
//   3. Throws LiveVoiceUnavailableError → Mock_Fallback in index.ts
//
// Transcripts are passed through lib/core/extract extractors (Req 6.4).
// ===========================================================================

import { isAgentPhoneEnabled, resolveGrokApiKey } from "@/lib/config";
import {
  AgentPhoneUnavailableError,
  runAgentPhoneSession,
} from "@/lib/agent/agentphone";
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

export class LiveVoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveVoiceUnavailableError";
  }
}

export { resolveGrokApiKey };

export function isLiveVoiceConfigured(): boolean {
  return resolveGrokApiKey() !== null || isAgentPhoneEnabled();
}

async function runGrokVoiceSession(
  _callType: CallType,
  _packet: AuthPacket,
): Promise<Turn[]> {
  if (!resolveGrokApiKey()) {
    throw new LiveVoiceUnavailableError("No Grok API key configured");
  }
  throw new LiveVoiceUnavailableError(
    "Live Grok Voice path is not enabled; use AgentPhone or Mock_Fallback.",
  );
}

/**
 * Run a live voice session: AgentPhone first, then Grok Voice stub.
 */
export async function runLiveVoiceSession(
  callType: CallType,
  packet: AuthPacket,
): Promise<Turn[]> {
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

  return runGrokVoiceSession(callType, packet);
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
