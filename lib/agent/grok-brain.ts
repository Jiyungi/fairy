// ===========================================================================
// Grok agentic brain for AgentPhone webhook-mode calls (lib/agent/grok-brain.ts)
//
// AgentPhone places a REAL phone call (webhook mode). On each turn it POSTs the
// caller's transcript to our webhook; THIS module asks xAI Grok what the Fairy
// agent should say next. Grok is the brain — it reasons over the couple's data
// + missing-data flags + call objectives and drives the conversation, asking
// one thing at a time, honoring the guardrails, and ending when done.
//
// Grounded in /reference-data/ only (no invented clinical values).
// ===========================================================================

import {
  resolveGrokApiKey,
  resolveXaiApiBaseUrl,
  resolveXaiModel,
} from "@/lib/config";
import {
  CLINIC_OBJECTIVES,
  INSURANCE_OBJECTIVES,
  SEED_COUPLE_FIXTURE,
} from "@/lib/reference";
import { detectMissingData } from "@/lib/core/missing-data";

/** One prior turn of the live call (from AgentPhone recentHistory / transcript). */
export interface BrainTurn {
  role: "agent" | "user";
  content: string;
}

export interface BrainReply {
  /** What the Fairy agent should say next (1–2 sentences). */
  text: string;
  /** True when every objective is covered and the agent should hang up. */
  done: boolean;
}

/** Build the grounded system prompt for the Fairy phone agent. */
function buildSystemPrompt(): string {
  const her = SEED_COUPLE_FIXTURE.herProfile;
  const him = SEED_COUPLE_FIXTURE.himProfile;
  const couple = SEED_COUPLE_FIXTURE.couple;

  const missing = detectMissingData({
    day3_fsh: her.day3_fsh,
    day3_estradiol: her.day3_estradiol,
    mid_luteal_progesterone: her.mid_luteal_progesterone,
    prolactin: her.prolactin,
    semen: {
      semenVolumeMl: him.volume_ml,
      concentrationMillionMl: him.concentration_million_ml,
      totalSpermMillion: him.total_count_million,
      totalMotilityPct: him.total_motility_pct,
      progressiveMotilityPct: him.progressive_motility_pct,
      vitalityPct: him.vitality_pct,
      normalMorphologyPct: him.morphology_normal_pct,
      phMin: him.ph,
    },
    coverage_status: couple.coverage_status,
  })
    .map((f) => `- ${f.label}: ${f.explanation}`)
    .join("\n");

  const objectives = [
    ...INSURANCE_OBJECTIVES.map((o, i) => `${i + 1}. ${o.summary}`),
    ...CLINIC_OBJECTIVES.map((o, i) => `${INSURANCE_OBJECTIVES.length + i + 1}. ${o.summary}`),
  ].join("\n");

  return [
    "You are Fairy, an authorized assistant making a phone call on behalf of a couple (Maya & Daniel) who are preparing for fertility care.",
    "You are calling a single line where the person plays BOTH the insurance representative and the clinic scheduler. Your job is to verify fertility benefits AND book a first consult.",
    "",
    `Couple: ${couple.display_name}. Insurance: ${couple.insurance_provider} ${couple.plan_type}, policy holder ${couple.policy_holder}. Coverage status: ${couple.coverage_status}.`,
    "",
    "Objectives to cover (work through them naturally, one question at a time):",
    objectives,
    "",
    "Context — what the couple still needs (use to explain why you're asking):",
    missing,
    "",
    "STRICT RULES:",
    "- Speak in 1–2 short, natural sentences. Ask ONE thing at a time. This is a live phone call.",
    "- WITHHOLD the member ID and date of birth until the person explicitly asks to verify identity; only then share them.",
    "- NEVER make a medical decision or accept a treatment plan on the couple's behalf. If asked, politely decline and say you'll note it as a follow-up for the couple.",
    "- Only state clinical facts that come from the couple's own data; do not invent numbers, codes, or coverage terms.",
    "- When you have covered the objectives (coverage facts + a booked consult date/time), thank them, confirm the booking back, say goodbye, and end the call.",
    "- When you are ending the call, end your message with the token [[END_CALL]] on its own.",
  ].join("\n");
}

const SYSTEM_PROMPT = buildSystemPrompt();
const END_TOKEN = "[[END_CALL]]";

/**
 * Ask Grok for the Fairy agent's next line given the conversation so far and
 * the caller's latest utterance. Returns the line to speak + whether to hang up.
 */
export async function nextAgentLine(
  history: BrainTurn[],
  latestCallerText: string,
): Promise<BrainReply> {
  const apiKey = resolveGrokApiKey();
  if (!apiKey) {
    // No key → a safe, generic continuation so the call doesn't go silent.
    return { text: "Thanks — could you share that detail one more time?", done: false };
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((t) => ({
      role: t.role === "agent" ? "assistant" : "user",
      content: t.content,
    })),
  ];
  if (latestCallerText.trim()) {
    messages.push({ role: "user", content: latestCallerText.trim() });
  }

  const res = await fetch(`${resolveXaiApiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveXaiModel(),
      messages,
      max_tokens: 160,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    return { text: "Sorry, could you repeat that?", done: false };
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  let text = json.choices?.[0]?.message?.content?.trim() ?? "";
  const done = text.includes(END_TOKEN);
  text = text.replace(END_TOKEN, "").trim();
  if (!text) text = done ? "Thank you, goodbye." : "Could you say that again?";

  return { text, done };
}
