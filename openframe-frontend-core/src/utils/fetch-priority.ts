import React from 'react';

/**
 * `fetchPriorityProp(priority)` — build the right shape for the `<img>` /
 * `<iframe>` fetch-priority hint based on the React major version detected
 * at module load.
 *
 * React 18 only recognizes the lowercase HTML attribute `fetchpriority`
 * and emits a console warning when it sees the camelCase prop. React 19+
 * recognizes the camelCase prop `fetchPriority` (matching the DOM's IDL
 * property) and warns when it sees the lowercase form.
 *
 * Spread the returned object into the element so the rendered DOM ends
 * up with the canonical lowercase `fetchpriority` attribute either way,
 * with zero console warnings on both React versions.
 *
 * Accepts either a boolean (for the simple "high vs low" hint at LCP
 * candidates) or an explicit HTML `fetchpriority` value (`'high' | 'low'
 * | 'auto'`) for call sites that always want one specific value.
 */
const REACT_MAJOR = parseInt((React.version || '0').split('.')[0], 10);
const USE_CAMEL_CASE_FETCH_PRIORITY = REACT_MAJOR >= 19;

export type FetchPriorityValue = 'high' | 'low' | 'auto';

export function fetchPriorityProp(
  priority: boolean | FetchPriorityValue,
): Record<string, string> {
  const value: FetchPriorityValue =
    typeof priority === 'boolean' ? (priority ? 'high' : 'low') : priority;
  return USE_CAMEL_CASE_FETCH_PRIORITY
    ? { fetchPriority: value }
    : { fetchpriority: value };
}
