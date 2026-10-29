/**
 * Escape every RegExp meta-character in `value`, so text can be matched
 * literally inside a `new RegExp(...)` (a search query of `(c)` or `a+b`, a URL
 * prefix). Zero-dependency and server-safe.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
