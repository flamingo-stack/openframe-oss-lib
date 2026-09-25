import { describe, expect, it } from 'vitest';
import {
  AnthropicLogoIcon,
  AzureAdLogoIcon,
  GoogleLogoIcon,
  MicrosoftLogoIcon,
  OpenaiLogoIcon,
} from '../../../icons-v2-generated/brand-logos';
import { brandLogoForName } from '../icon-library';

describe('brandLogoForName', () => {
  it('finds the brand in a product name, whatever the casing or suffix', () => {
    expect(brandLogoForName('Google Cloud Platform')).toBe(GoogleLogoIcon);
    expect(brandLogoForName('google workspace')).toBe(GoogleLogoIcon);
    expect(brandLogoForName('Anthropic')).toBe(AnthropicLogoIcon);
    expect(brandLogoForName('OpenAI')).toBe(OpenaiLogoIcon);
    expect(brandLogoForName('Microsoft 365')).toBe(MicrosoftLogoIcon);
  });

  it('prefers the longest run of words, so a multi-word brand beats a shorter one', () => {
    expect(brandLogoForName('Azure AD')).toBe(AzureAdLogoIcon);
  });

  it('answers null for a name the icon set has no mark for', () => {
    expect(brandLogoForName('Acme Analytics')).toBeNull();
    expect(brandLogoForName('')).toBeNull();
    expect(brandLogoForName(null)).toBeNull();
  });
});
