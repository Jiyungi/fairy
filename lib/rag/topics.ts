import type { CanonicalQuestionId } from "@/lib/chat/grounded-chat";
import type { KnowledgeTopic } from "@/lib/rag/types";

const FILE_TOPICS: Record<string, KnowledgeTopic> = {
  "cycle-fertility-reference.md": "cycle",
  "semen-analysis-reference.md": "semen",
  "female-hormone-reference.md": "hormone",
  "insurance-coverage-data.md": "insurance",
  "clinic-intake-data.md": "clinic",
  "cpt-codes-fertility.md": "cpt",
  "call-scripts.md": "calls",
  "sample-couple.md": "couple",
  "README.md": "general",
};

const QUESTION_TOPICS: Record<CanonicalQuestionId, KnowledgeTopic[]> = {
  priority_days: ["cycle", "couple"],
  partner_this_week: ["semen", "couple", "clinic"],
  confidence_low: ["cycle", "hormone", "couple"],
  ask_doctor: ["cycle", "semen", "hormone", "clinic", "cpt"],
  missing_data: ["hormone", "semen", "insurance", "couple"],
};

export function topicForSourceFile(filename: string): KnowledgeTopic {
  return FILE_TOPICS[filename] ?? "general";
}

export function topicsForQuestion(questionId: CanonicalQuestionId): KnowledgeTopic[] {
  return QUESTION_TOPICS[questionId];
}

export function topicsForFreeText(text: string): KnowledgeTopic[] {
  const n = text.toLowerCase();
  const topics = new Set<KnowledgeTopic>();
  if (/insurance|coverage|prior auth|cpt|deductible/.test(n)) topics.add("insurance");
  if (/semen|partner|daniel|his|male|motility|who/.test(n)) topics.add("semen");
  if (/cycle|ovulation|fertile|priority|window|timing/.test(n)) topics.add("cycle");
  if (/hormone|amh|fsh|progesterone|lab/.test(n)) topics.add("hormone");
  if (/clinic|appointment|doctor|consult/.test(n)) topics.add("clinic");
  if (/missing|data|test/.test(n)) {
    topics.add("hormone");
    topics.add("semen");
    topics.add("insurance");
  }
  if (topics.size === 0) topics.add("general");
  return [...topics];
}
