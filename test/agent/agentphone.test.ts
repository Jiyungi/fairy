import { describe, expect, it } from "vitest";

import { parseAgentPhoneTranscript } from "@/lib/agent/agentphone";
import { buildAgentPhoneCallPrompt } from "@/lib/agent/prompts";
import { SEED_AUTH_PACKET } from "@/lib/reference";
import { INSURANCE_QUESTIONS, CLINIC_CALL_QUESTIONS } from "@/lib/reference/call-scripts";
import { isAgentPhoneEnabled, resolveAgentPhoneConfig } from "@/lib/config";

describe("AgentPhone prompts", () => {
  it("includes all 10 insurance questions in order", () => {
    const { systemPrompt } = buildAgentPhoneCallPrompt("insurance", SEED_AUTH_PACKET);
    for (const q of INSURANCE_QUESTIONS) {
      expect(systemPrompt).toContain(q);
    }
  });

  it("includes all 7 clinic questions in order", () => {
    const { systemPrompt } = buildAgentPhoneCallPrompt("clinic", SEED_AUTH_PACKET);
    for (const q of CLINIC_CALL_QUESTIONS) {
      expect(systemPrompt).toContain(q);
    }
  });

  it("does not put member ID in the insurance opening greeting", () => {
    const { initialGreeting } = buildAgentPhoneCallPrompt("insurance", SEED_AUTH_PACKET);
    expect(initialGreeting).not.toContain(SEED_AUTH_PACKET.member_id);
  });
});

describe("AgentPhone transcript parsing", () => {
  it("maps role-based message arrays to Turn[]", () => {
    const turns = parseAgentPhoneTranscript([
      { role: "assistant", content: "Hello, verifying coverage." },
      { role: "user", content: "Sure, go ahead." },
    ]);
    expect(turns).toEqual([
      { speaker: "agent", text: "Hello, verifying coverage." },
      { speaker: "responder", text: "Sure, go ahead." },
    ]);
  });

  it("parses agent:/responder: prefixed lines", () => {
    const turns = parseAgentPhoneTranscript(
      "Agent: First question?\nResponder: Yes, covered.",
    );
    expect(turns[0]).toEqual({ speaker: "agent", text: "First question?" });
    expect(turns[1]).toEqual({ speaker: "responder", text: "Yes, covered." });
  });
});

describe("AgentPhone config", () => {
  it("is disabled without USE_AGENTPHONE", () => {
    expect(
      isAgentPhoneEnabled({
        USE_AGENTPHONE: "false",
        AGENTPHONE_API_KEY: "key",
        AGENTPHONE_AGENT_ID: "agent",
        AGENTPHONE_TO_NUMBER: "+15551234567",
      }),
    ).toBe(false);
  });

  it("resolves config when enabled and complete", () => {
    const cfg = resolveAgentPhoneConfig({
      AGENTPHONE_API_KEY: "sk_test",
      AGENTPHONE_AGENT_ID: "agt_1",
      AGENTPHONE_FROM_NUMBER_ID: "num_1",
      AGENTPHONE_TO_NUMBER: "+15551234567",
    });
    expect(cfg?.agentId).toBe("agt_1");
    expect(cfg?.toNumber).toBe("+15551234567");
    expect(
      isAgentPhoneEnabled({
        USE_AGENTPHONE: "true",
        AGENTPHONE_API_KEY: "sk_test",
        AGENTPHONE_AGENT_ID: "agt_1",
        AGENTPHONE_TO_NUMBER: "+15551234567",
      }),
    ).toBe(true);
  });
});
