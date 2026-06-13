/**
 * Centralized config / secret resolution (lib/config.ts) — Req 15.4, 15.5
 *
 * Single source of truth for Grok key resolution, mock-fallback policy, and
 * Supabase connection settings. Other modules import from here rather than
 * re-implementing resolution logic.
 */

/** Names of the environment variables that may hold the Grok API key. */
export const GROK_API_KEY_ENV_NAMES = ["XAI_API_KEY", "GROK_API_KEY"] as const;

/**
 * Resolve the Grok API key: `XAI_API_KEY` first, then `GROK_API_KEY` (Req 15.4).
 */
export function resolveGrokApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const xai = env.XAI_API_KEY?.trim();
  if (xai) return xai;

  const grok = env.GROK_API_KEY?.trim();
  if (grok) return grok;

  return null;
}

/** Whether a live Grok key is configured. */
export function hasGrokApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveGrokApiKey(env) !== null;
}

/**
 * Whether the deterministic Mock_Fallback must be used (Req 15.5).
 * Forced when no Grok key is set, or when `USE_MOCK_AI=true`.
 */
export function isMockFallbackForced(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (resolveGrokApiKey(env) === null) return true;
  return parseBooleanEnv(env.USE_MOCK_AI);
}

export interface FairyConfig {
  grokApiKey: string | null;
  useMockFallback: boolean;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): FairyConfig {
  return {
    grokApiKey: resolveGrokApiKey(env),
    useMockFallback: isMockFallbackForced(env),
  };
}

export interface SupabaseConfig {
  url: string;
  key: string;
  usingServiceRole: boolean;
}

export function resolveSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole) {
    return { url, key: serviceRole, usingServiceRole: true };
  }

  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon) {
    return { url, key: anon, usingServiceRole: false };
  }

  return null;
}

export function hasSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveSupabaseConfig(env) !== null;
}

/** xAI REST base URL for chat and embeddings. */
export function resolveXaiApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.XAI_API_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, "");
}

export function resolveXaiModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.XAI_MODEL?.trim() || "grok-4";
}

export interface AgentPhoneConfig {
  apiKey: string;
  agentId: string;
  fromNumberId: string | null;
  toNumber: string;
  baseUrl: string;
}

/** AgentPhone REST base URL. */
export function resolveAgentPhoneBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return (env.AGENTPHONE_BASE_URL?.trim() || "https://api.agentphone.ai/v1").replace(
    /\/$/,
    "",
  );
}

export function resolveAgentPhoneConfig(
  env: Record<string, string | undefined> = process.env,
): AgentPhoneConfig | null {
  const apiKey = env.AGENTPHONE_API_KEY?.trim();
  const agentId = env.AGENTPHONE_AGENT_ID?.trim();
  const toNumber = env.AGENTPHONE_TO_NUMBER?.trim();
  if (!apiKey || !agentId || !toNumber) return null;

  return {
    apiKey,
    agentId,
    fromNumberId: env.AGENTPHONE_FROM_NUMBER_ID?.trim() || null,
    toNumber,
    baseUrl: resolveAgentPhoneBaseUrl(env),
  };
}

/** True when USE_AGENTPHONE is enabled and required env vars are set. */
export function isAgentPhoneEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!parseBooleanEnv(env.USE_AGENTPHONE)) return false;
  return resolveAgentPhoneConfig(env) !== null;
}

/** Redis URL for AgentPhone RAG hot path. */
export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.REDIS_URL?.trim();
  return url || null;
}

/** RediSearch index name for knowledge chunks. */
export function resolveRedisVectorIndex(env: NodeJS.ProcessEnv = process.env): string {
  return env.REDIS_VECTOR_INDEX?.trim() || "fairy-rag";
}

export function hasRedisConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveRedisUrl(env) !== null;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}
