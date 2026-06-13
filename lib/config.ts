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
