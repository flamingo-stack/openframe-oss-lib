import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility functions for common operations
 */

/**
 * Merge class names with Tailwind CSS
 * @param inputs - Class names to merge
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Human-readable message for a caught value.
 *
 * `catch (e)` binds `unknown` under this tsconfig, and a thrown value is not
 * guaranteed to be an `Error`. Use this instead of `catch (e: any)` +
 * `e.message`, which crashes on a thrown string/object with no `message`.
 *
 * @param error - The caught value
 * @param fallback - Returned when the value carries no usable message
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/**
 * Human-readable message for a FAILED API response body.
 *
 * `Response.json()` is typed `any`, so `body.error` used to be read off an
 * `any` at every call site. The platform's route helpers answer errors with
 * `{ error, code, details }` (see `errorResponse` in the hub's
 * `lib/api/route-base.ts`); a few endpoints answer `{ message }` instead, so
 * both are accepted before giving up.
 *
 * @param payload - The parsed response body (or whatever came back)
 * @param fallback - Returned when the body carries no usable message
 */
export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const { error } = payload;
    if (typeof error === 'string' && error) return error;
  }
  return errorMessage(payload, fallback);
}

/**
 * Delay execution for a specified time
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string of specified length
 * @param length - Length of the string
 * @returns Random string
 */
export function generateRandomString(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Truncate a string to a specified length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add to truncated string
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Serialize a JSON-LD schema for a `<script type="application/ld+json">`
 * block — THE one home of the escape rule (the hub re-exports this from
 * lib/utils/breadcrumbs). JSON.stringify does NOT HTML-escape: a stored
 * "</script>" inside any admin/user-entered field would terminate the tag
 * early (stored XSS). Every "<" becomes the JSON escape sequence
 * backslash-u003c — still valid JSON, inert in HTML.
 */
export function serializeJsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

/**
 * Deep clone an object through a JSON round-trip.
 *
 * Lossy by construction, and deliberately so — this is the JSON projection of
 * `T`: `undefined` members and functions are dropped, `Date` becomes an ISO
 * string, `Map`/`Set` become `{}`, and a cyclic graph throws. Reach for
 * `structuredClone` when any of that matters.
 *
 * `JSON.parse` is typed `any`; the assertion states the contract above, which
 * is the closest a JSON clone can get to "still a `T`".
 *
 * @param obj - Object to clone (must be JSON-serializable)
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Get the Slack community join URL from environment variables
 * @returns Slack community join URL or fallback URL
 */
export function getSlackCommunityJoinUrl(): string {
  const url = process.env.NEXT_PUBLIC_SLACK_COMMUNITY_JOIN_URL;
  if (!url) {
    console.warn('NEXT_PUBLIC_SLACK_COMMUNITY_JOIN_URL is not defined in environment variables');
    return 'https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA';
  }
  return url;
}
