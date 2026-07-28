/**
 * Channel routing defaults.
 *
 * Each requesting channel (digital onboarding, premium branch, savings at a
 * specific branch, …) attaches its own `accountOfficer` and `productType` so
 * T24 can open the right account under the right officer. When a channel omits
 * either value, the middleware falls back to the values configured here.
 *
 * Server-only: these read `process.env` and must never be imported from a
 * client component (non-`NEXT_PUBLIC_` vars are not in the browser bundle).
 */

function readEnv(key: string): string {
  return (process.env[key] || '').trim();
}

/** Officer code used when a channel does not send one. */
export const DEFAULT_ACCOUNT_OFFICER = readEnv('DEFAULT_ACCOUNT_OFFICER') || '6409';

/**
 * Product code used when a channel does not send one.
 *
 * Deliberately has no hardcoded fallback: T24 now requires a product on every
 * CustomerCreate, and silently inventing a code would open accounts under the
 * wrong product. If this is unset and a channel sends nothing, the T24 payload
 * validation fails with an actionable message instead.
 */
export const DEFAULT_PRODUCT_TYPE = readEnv('DEFAULT_PRODUCT_TYPE');

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = (value || '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** Channel value if supplied, otherwise the configured default. */
export function resolveAccountOfficer(supplied?: string | null): string {
  return firstNonEmpty(supplied, DEFAULT_ACCOUNT_OFFICER);
}

/** Channel value if supplied, otherwise the configured default (may be ''). */
export function resolveProductType(supplied?: string | null): string {
  return firstNonEmpty(supplied, DEFAULT_PRODUCT_TYPE);
}
