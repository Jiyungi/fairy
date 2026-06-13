// ===========================================================================
// Trying-duration evaluation-timing thresholds and red-flag conditions.
// SOURCE (verbatim): reference-data/cycle-fertility-reference.md
//   "When to seek evaluation (the agent's trigger rule — F7)".
// SINGLE SOURCE OF TRUTH — no duration-rule literal lives elsewhere.
// ===========================================================================

export const DURATION_RULE = {
  under35Months: 12, // Under 35: evaluate after 12 months
  atLeast35Months: 6, // 35 or older: evaluate after 6 months
  ageThreshold: 35,
} as const;

// "Sooner if there are red flags (irregular/absent periods, known
//  PCOS/endometriosis, prior pelvic surgery, known male factor)."
export const DURATION_RED_FLAGS = [
  "irregular/absent periods",
  "known PCOS/endometriosis",
  "prior pelvic surgery",
  "known male factor",
] as const;

// reference-data/cycle-fertility-reference.md — "Cycle regularity reference"
export const CYCLE_REGULARITY = {
  regularMinDays: 24, // Regular: ~24–38 days, consistent month to month
  regularMaxDays: 38,
  irregularVariationDays: 7, // Irregular: varies > 7–9 days, or outside 24–38
} as const;

export type DurationRule = typeof DURATION_RULE;
