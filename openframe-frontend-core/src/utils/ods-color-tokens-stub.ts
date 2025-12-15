// Stub for ODS color tokens
export const colorTokens = {
  primary: '#FFC008',
  secondary: '#161616',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: {
    primary: '#161616',
    secondary: '#666666',
    inverse: '#FFFFFF'
  },
  border: '#E5E5E5'
} as const;

export function getColorValue(tokenPath: string): string {
  // Simple stub implementation
  return tokenPath.includes('primary') ? '#FFC008' : '#161616';
}