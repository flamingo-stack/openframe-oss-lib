import { describe, expect, it } from 'vitest';
import { findIcon } from '../../components/chat/utils/icon-library';
import { AI_PROVIDERS, aiProvider } from '../ai-providers';
import { tokenRateProviderLabel } from '../model-token-rates';

describe('aiProvider', () => {
  it('names a listed provider and its mark, and every listed mark is in the icon set', () => {
    expect(aiProvider('OPENAI')).toEqual({ label: 'OpenAI', icon: 'openai-logo-grey' });
    for (const provider of Object.values(AI_PROVIDERS)) expect(findIcon(provider.icon)).not.toBeNull();
  });

  it('lets what the host stated win', () => {
    expect(aiProvider('OPENAI', { label: 'OpenAI Inc', icon: 'openai-logo' })).toEqual({
      label: 'OpenAI Inc',
      icon: 'openai-logo',
    });
    expect(tokenRateProviderLabel('ANTHROPIC', 'Claude by Anthropic')).toBe('Claude by Anthropic');
    expect(tokenRateProviderLabel('ANTHROPIC', null)).toBe('Anthropic');
  });

  it('reads an unlisted provider from its key, and its mark by the icon set naming', () => {
    expect(aiProvider('SOME_NEW_LAB')).toEqual({ label: 'Some New Lab', icon: 'some-new-lab-logo-grey' });
    // The set holds no such mark: the surface draws the name alone.
    expect(findIcon(aiProvider('SOME_NEW_LAB').icon)).toBeNull();
    // A provider the set does hold a mark for needs no entry here.
    expect(findIcon(aiProvider('GOOGLE').icon)).not.toBeNull();
  });
});
