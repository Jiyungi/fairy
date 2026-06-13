// ===========================================================================
// Centralized config / secret resolution (lib/config.ts) — Req 15.4, 15.5
//
// This is the single canonical place that resolves the Grok API key and
// decides whether the deterministic Mock_Fallback must be used. Other modules
// (e.g. lib/agent/live.ts, lib/chat/live.ts) import from here rather than
// re-implementing the resolution, so there is exactly one source of truth.
//
// All functions read `process.env` at call time and contain no I/O, which
// keeps them pure with respect to their (environment) input and trivially
// testable: set/unset env vars, call, assert.
// ===========================================================================

/**
 * Resolve the Grok API key.
 *
 * Resolution order (Req 15.4):
 *   1. `XAI_API_KEY`
 *   2. `GROK_API_KEY` (fallback when `XAI_API_KEY` is absent)
 *
 * Returns `null` when neither is set (or both are blank/whitespace), which is
 * the signal to fall back to the deterministic Mock_Fallback.
 */
export function resolveGrokApiKey(): string | null {
  const xai = process.env.XAI_API_KEY;
  if (typeof xai === "string" && xai.trim().length > 0) return xai;

  const grok = process.env.GROK_API_KEY;
  if (typeof grok === "string" && grok.trim().length > 0) return grok;

  return null;
}

/**
 * Whether the deterministic Mock_Fallback must be used for Grok / Grok Voice
 * calls (Req 15.5).
 *
 * Forced when NEITHER `XAI_API_KEY` nor `GROK_API_KEY` is set, so the demo
 * always continues without interruption even with no secrets configured. The
 * `USE_MOCK_AI=true` toggle (documented in `.env_example`) also forces the
 * fallback so rehearsals can avoid burning credits or risking a live failure.
 */
export function isMockFallbackForced(): boolean {
  if (resolveGrokApiKey() === null) return true;
  return parseBooleanEnv(process.env.USE_MOCK_AI);
}

/** Typed view of the resolved runtime config. */
export interface FairyConfig {
  /** The resolved Grok API key, or null when neither env var is set. */
  grokApiKey: string | null;
  /** True when the deterministic Mock_Fallback must be used. */
  useMockFallback: boolean;
}

/**
 * Build the typed config object from the current environment. Reads
 * `process.env` at call time so callers always see the latest values.
 */
export function getConfig(): FairyConfig {
  return {
    grokApiKey: resolveGrokApiKey(),
    useMockFallback: isMockFallbackForced(),
  };
}

/** Parse a boolean-ish env var ("true"/"1"/"yes"); defaults to false. */
function parseBooleanEnv(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}
