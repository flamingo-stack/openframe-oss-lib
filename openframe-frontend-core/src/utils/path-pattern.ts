/**
 * A PATH PATTERN is a regular expression matched against a WHOLE pathname:
 * `/` matches the home page only, `/blog/.*` every page under the blog,
 * `/(pricing|trial)` either page. A plain path is a pattern that matches
 * itself. Used wherever an admin lists the pages something applies to (an
 * announcement's "hidden on" list).
 *
 * The whole pathname must match (the pattern is anchored at both ends), so
 * `/blog` never matches `/blog/post`. A pattern that does not compile matches
 * nothing; `isValidPathPattern` lets a form say so before it is saved.
 */
function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(`^(?:${pattern})$`);
  } catch {
    return null;
  }
}

export function isValidPathPattern(pattern: string): boolean {
  return pattern.trim().length > 0 && compile(pattern.trim()) !== null;
}

export function matchesPathPattern(pathname: string, pattern: string): boolean {
  return compile(pattern.trim())?.test(pathname) ?? false;
}

/** True when the pathname matches any pattern of the list. */
export function pathMatchesAny(pathname: string, patterns: readonly string[] | null | undefined): boolean {
  return (patterns ?? []).some(pattern => matchesPathPattern(pathname, pattern));
}
