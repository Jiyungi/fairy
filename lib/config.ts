/**
 * Environment / secrets handling stubs.
 *
 * The Grok API key is read from `XAI_API_KEY` in `.env.local`, falling back to
 * `GROK_API_KEY` when `XAI_API_KEY` is absent (Requirement 15.4 / 15.7).
 *
 * No secret values are committed — only the variable *names* are referenced
 * here and documented in `.env_example`. Full resolution behavior (including
 * the Mock_Fallback decision) is expanded in task 19.3.
 */

/** Names of the environment variables that may hold the Grok API key. */
export const GROK_API_KEY_ENV_NAMES = ["XAI_API_KEY", "GROK_API_KEY"] as const;

/**
 * Resolve the Grok API key, preferring `XAI_API_KEY` and falling back to
 * `GROK_API_KEY`. Returns `null` when neither is set (callers use the
 * deterministic Mock_Fallback in that case).
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

/** Whether a live Grok key is configured at all. */
export function hasGrokApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveGrokApiKey(env) !== null;
}

/**
 * Supabase connection configuration (Req 11, 15.3).
 *
 * As with the Grok key, only variable *names* are referenced here — no secret
 * values are committed. Resolution is guarded so importing the DB client never
 * crashes when the environment is absent (tests / build run without a live DB);
 * callers decide what to do when configuration is missing.
 */
export interface SupabaseConfig {
  url: string;
  /**
   * The key the client authenticates with. Prefers the server-only service-role
   * key (used for seeding and workflow writes) and falls back to the public
   * anon key.
   */
  key: string;
  /** True when the resolved key was the service-role key. */
  usingServiceRole: boolean;
}

/**
 * Resolve the Supabase URL and key from the environment. Prefers
 * `SUPABASE_SERVICE_ROLE_KEY` (server-only) and falls back to
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Returns `null` when the URL or both keys are
 * absent so the caller can run without a live database.
 */
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

/** Whether a usable Supabase configuration is present in the environment. */
export function hasSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveSupabaseConfig(env) !== null;
}
