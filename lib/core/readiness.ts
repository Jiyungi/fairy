// STUB (Person A owns the real implementation — replaced at merge). Returns seed-correct values for Person B integration.
//
// Readiness-Score logic (Req 1.4, 5.4). Completing a male-track task increases the score;
// the result is always an integer clamped to [0, 100] and never decreases on completion.

/**
 * Apply a completed male-track task's weight to the current readiness score.
 * @param score current score (expected 0–100)
 * @param weight task weight (non-negative contribution)
 * @returns integer score clamped to [0, 100], never below the incoming score
 */
export function applyTaskCompletion(score: number, weight: number): number {
  const safeScore = Number.isFinite(score) ? score : 0;
  const safeWeight = Number.isFinite(weight) ? Math.max(0, weight) : 0;
  const raised = safeScore + safeWeight;
  const clamped = Math.min(100, Math.max(0, raised));
  // Never decrease relative to the incoming score (also clamped into range).
  const floor = Math.min(100, Math.max(0, safeScore));
  return Math.round(Math.max(clamped, floor));
}
