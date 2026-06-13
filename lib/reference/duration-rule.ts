/**
 * Trying-Duration rule thresholds.
 *
 * Source: reference-data/cycle-fertility-reference.md — "When to seek evaluation
 * (the agent's trigger rule — F7)":
 *   - Under 35: evaluate after 12 months of trying without conceiving.
 *   - 35 or older: evaluate after 6 months.
 *   - Sooner if there are red flags.
 *
 * No clinical literal lives outside this constant (Req 12.1).
 */
export const DURATION_RULE = {
  under35Months: 12,
  atLeast35Months: 6,
  ageThreshold: 35,
} as const;
