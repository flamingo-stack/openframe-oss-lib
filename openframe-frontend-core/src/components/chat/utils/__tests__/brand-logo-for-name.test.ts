import { describe, expect, it } from 'vitest';
import { brandLogoForName } from '../icon-library';

/** The set's icon a name resolved to: the resolver loads it on demand and names its component after it. */
const logoOf = (name: string | null) => brandLogoForName(name)?.displayName ?? null;

describe('brandLogoForName', () => {
  it('finds the brand in a product name, whatever the casing or suffix', () => {
    expect(logoOf('Google Cloud Platform')).toBe('GoogleLogoIcon');
    expect(logoOf('google workspace')).toBe('GoogleLogoIcon');
    expect(logoOf('Anthropic')).toBe('AnthropicLogoIcon');
    expect(logoOf('OpenAI')).toBe('OpenaiLogoIcon');
    expect(logoOf('Microsoft 365')).toBe('MicrosoftLogoIcon');
  });

  it('prefers the longest run of words, so a multi-word brand beats a shorter one', () => {
    expect(logoOf('Azure AD')).toBe('AzureAdLogoIcon');
  });

  it('answers null for a name the icon set has no mark for', () => {
    expect(brandLogoForName('Acme Analytics')).toBeNull();
    expect(brandLogoForName('')).toBeNull();
    expect(brandLogoForName(null)).toBeNull();
  });
});
