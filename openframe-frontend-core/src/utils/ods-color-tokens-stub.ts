// TEST-ONLY STUB — NOT a source of truth for ODS color tokens.
// Do NOT import this module from production code. Real consumers must
// obtain color tokens from the design-system's generated token package
// (the actual ODS token generation pipeline), not from this stub.
// This file exists solely to support local tests/mocking and should be
// excluded from the package's public `exports` map.
export const colorTokens = {
  primary: '#FFC008',
  secondary: '#161616',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: {
    primary: '#161616',
    secondary: '#666666',
    inverse: '#FFFFFF',
  },
  border: '#E5E5E5',
} as const;

/**
 * @deprecated Test-only stub. Do not use in production; string-matches on
 * 'primary' and returns hardcoded hex values. Use the real generated ODS
 * token lookup instead.
 */
export function getColorValue(tokenPath: string): string {
  // Simple stub implementation
  return tokenPath.includes('primary') ? '#FFC008' : '#161616';
}

