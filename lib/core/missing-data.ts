// STUB (Person A owns the real implementation — replaced at merge). Returns seed-correct values for Person B integration.
//
// Missing-Data Detector (Req 4). Person B's workflow & doctor summary consume the flags,
// so the documented rules are implemented reasonably here.

import type { DataFlag, MissingDataInput } from "@/lib/types";

// WHO 2021 lower reference limits — semen-analysis-reference.md
const WHO_2021 = {
  volume_ml: 1.4,
  concentration_million_ml: 16,
  total_count_million: 39,
  total_motility_pct: 42,
  progressive_motility_pct: 30,
  vitality_pct: 54,
  morphology_normal_pct: 4,
  // pH has a lower limit of 7.2; treated as borderline if below.
  ph: 7.2,
} as const;

const SEMEN_LABELS: Record<keyof typeof WHO_2021, string> = {
  volume_ml: "Semen volume (mL)",
  concentration_million_ml: "Sperm concentration (million/mL)",
  total_count_million: "Total sperm count (million)",
  total_motility_pct: "Total motility (%)",
  progressive_motility_pct: "Progressive motility (%)",
  vitality_pct: "Vitality (%)",
  morphology_normal_pct: "Normal morphology (%)",
  ph: "pH",
};

const REPEAT_RECOMMENDATION =
  "Below the WHO 2021 lower reference limit. Recommend one repeat analysis after 2–7 days of abstinence.";

export function detectMissingData(input: MissingDataInput): DataFlag[] {
  const flags: DataFlag[] = [];

  // Female labs — missing when null (Req 4.2–4.4).
  if (input.labs.day3_fsh === null) {
    flags.push({
      id: "day3_fsh",
      kind: "missing",
      label: "Day-3 FSH",
      explanation: "Drawn on cycle day 2–3 for ovarian-reserve assessment.",
      source: "female-hormone-reference.md",
    });
  }
  if (input.labs.day3_estradiol === null) {
    flags.push({
      id: "day3_estradiol",
      kind: "missing",
      label: "Day-3 estradiol",
      explanation: "Drawn on cycle day 2–3 alongside FSH for ovarian-reserve assessment.",
      source: "female-hormone-reference.md",
    });
  }
  if (input.labs.mid_luteal_progesterone === null) {
    flags.push({
      id: "mid_luteal_progesterone",
      kind: "missing",
      label: "Mid-luteal progesterone",
      explanation:
        "Ovulation cannot be confirmed without a mid-luteal progesterone rise toward ≈10 ng/mL.",
      source: "female-hormone-reference.md",
    });
  }
  if (input.labs.prolactin === null) {
    flags.push({
      id: "prolactin",
      kind: "missing",
      label: "Prolactin",
      explanation: "Part of the pituitary/ovulation screen.",
      source: "female-hormone-reference.md",
    });
  }

  // Semen parameters — borderline iff below WHO 2021 limit (Req 4.5).
  (Object.keys(WHO_2021) as Array<keyof typeof WHO_2021>).forEach((param) => {
    const value = input.semen[param];
    if (value !== null && value !== undefined && value < WHO_2021[param]) {
      flags.push({
        id: param,
        kind: "borderline",
        label: SEMEN_LABELS[param],
        explanation: REPEAT_RECOMMENDATION,
        source: "semen-analysis-reference.md",
      });
    }
  });

  // Insurance — unverified iff status != "confirmed" (Req 4.6).
  if (input.coverage_status !== "confirmed") {
    flags.push({
      id: "insurance_coverage",
      kind: "unverified",
      label: "Insurance coverage",
      explanation: "Coverage is not confirmed; verification is required before care.",
      source: "insurance-coverage-data.md",
    });
  }

  return flags;
}
