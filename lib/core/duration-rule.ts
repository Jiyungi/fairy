// STUB (Person A owns the real implementation — replaced at merge). Returns seed-correct values for Person B integration.
//
// Trying-Duration Rule (Req 7.4–7.6). Grounded in cycle-fertility-reference.md.

import type { DurationInput, DurationResult } from "@/lib/types";

const AGE_THRESHOLD = 35;

export function checkDurationRule(input: DurationInput): DurationResult {
  const thresholdMonths: 6 | 12 = input.femaleAge < AGE_THRESHOLD ? 12 : 6;
  const redFlags = input.redFlags ?? [];

  // Any red flag forces early evaluation regardless of months trying / threshold (Req 7.5).
  const recommendEarlyEvaluation =
    redFlags.length > 0 || input.monthsTrying >= thresholdMonths;

  return {
    thresholdMonths,
    recommendEarlyEvaluation,
    redFlags,
  };
}
