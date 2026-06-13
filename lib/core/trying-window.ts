// STUB (Person A owns the real implementation — replaced at merge). Returns seed-correct values for Person B integration.
//
// NOTE: The documented algorithm IS implemented here for real, because Person B's
// workflow depends on correct dates. Grounded in cycle-fertility-reference.md (Req 3).

import type { TryingWindowInput, TryingWindowOutput } from "@/lib/types";

export class TryingWindowInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TryingWindowInputError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseISODate(value: string): number {
  // Returns epoch-ms at UTC midnight for the given YYYY-MM-DD.
  const [y, m, d] = value.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = formatISODate(ms);
  if (back !== value) {
    // Catches impossible calendar dates like 2026-02-30.
    throw new TryingWindowInputError(`Invalid calendar date: ${value}`);
  }
  return ms;
}

function formatISODate(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear().toString().padStart(4, "0");
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = dt.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(ms: number, days: number): number {
  return ms + days * 86_400_000;
}

/**
 * Compute the fertile/priority window from the female partner's cycle inputs.
 * Male data is intentionally not part of the signature (Req 3.6).
 */
export function computeTryingWindow(input: TryingWindowInput): TryingWindowOutput {
  if (input == null || typeof input !== "object") {
    throw new TryingWindowInputError("Missing trying-window input");
  }

  const { lastPeriodStart, cycleLengthMin, cycleLengthMax, ovulationConfirmed } = input;

  if (typeof lastPeriodStart !== "string" || !ISO_DATE.test(lastPeriodStart)) {
    throw new TryingWindowInputError("lastPeriodStart must be an ISO date (YYYY-MM-DD)");
  }
  if (!Number.isFinite(cycleLengthMin) || !Number.isInteger(cycleLengthMin) || cycleLengthMin <= 0) {
    throw new TryingWindowInputError("cycleLengthMin must be a positive integer");
  }
  if (!Number.isFinite(cycleLengthMax) || !Number.isInteger(cycleLengthMax) || cycleLengthMax <= 0) {
    throw new TryingWindowInputError("cycleLengthMax must be a positive integer");
  }
  if (cycleLengthMax < cycleLengthMin) {
    throw new TryingWindowInputError("cycleLengthMax must be >= cycleLengthMin");
  }

  const start = parseISODate(lastPeriodStart);

  const minOvulationMs = addDays(start, cycleLengthMin - 14);
  const maxOvulationMs = addDays(start, cycleLengthMax - 14);
  const fertileStartMs = addDays(minOvulationMs, -5);
  const fertileEndMs = addDays(maxOvulationMs, 1);

  const isWide = cycleLengthMax - cycleLengthMin > 7;
  let confidence: TryingWindowOutput["confidence"] = "High";
  let reasons: string[] = [];

  if (!ovulationConfirmed && isWide) {
    confidence = "Low";
    reasons = ["irregular cycle", "ovulation not confirmed", "wide cycle range"];
  } else if (!ovulationConfirmed || isWide) {
    confidence = "Moderate";
    if (!ovulationConfirmed) reasons.push("ovulation not confirmed");
    if (isWide) reasons.push("wide cycle range");
  }

  return {
    fertileWindowStart: formatISODate(fertileStartMs),
    fertileWindowEnd: formatISODate(fertileEndMs),
    minOvulation: formatISODate(minOvulationMs),
    maxOvulation: formatISODate(maxOvulationMs),
    confidence,
    reasons,
  };
}
