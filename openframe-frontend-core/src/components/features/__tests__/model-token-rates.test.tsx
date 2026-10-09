import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  TOKEN_RATE_EMPTY,
  tokenRateProviderLabel,
} from '../../../utils/model-token-rates';
import { MODEL_TOKEN_RATES_COPY, ModelTokenRates } from '../model-token-rates';

const RATES: ModelTokenRate[] = [
  {
    modelName: 'claude-opus-5-5',
    displayName: 'Claude Opus 5.5',
    providerType: 'ANTHROPIC',
    inputTokenRate: 1.3333,
    outputTokenRate: 6.6667,
    cacheReadInputTokenRate: 0.0667,
  },
  {
    modelName: 'gpt-6-luna',
    displayName: 'GPT-6 Luna',
    providerType: 'OPENAI',
    inputTokenRate: 0.0333,
    outputTokenRate: 0.1667,
    cacheReadInputTokenRate: 0.0033,
  },
  {
    modelName: 'claude-sonnet-4-6',
    displayName: null,
    providerType: 'ANTHROPIC',
    inputTokenRate: 1,
    outputTokenRate: 5,
  },
];

describe('formatTokenRate', () => {
  it('writes a rate as a multiplier, two decimals from 0.1 up', () => {
    expect(formatTokenRate(1.3333)).toBe('1.33×');
    expect(formatTokenRate(5)).toBe('5×');
    expect(formatTokenRate(16.6667)).toBe('16.67×');
    expect(formatTokenRate(0.1667)).toBe('0.17×');
  });

  it('keeps two significant digits under 0.1, so a cheap rate is never rounded to nothing', () => {
    expect(formatTokenRate(0.0333)).toBe('0.033×');
    expect(formatTokenRate(0.0033)).toBe('0.0033×');
  });

  it('states no figure for a rate that is missing, zero or not a number', () => {
    for (const value of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatTokenRate(value)).toBe(TOKEN_RATE_EMPTY);
    }
  });
});

describe('providers', () => {
  it('groups the rates under their providers in the order given', () => {
    const groups = groupTokenRatesByProvider(RATES);
    expect(groups.map(group => group.providerType)).toEqual(['ANTHROPIC', 'OPENAI']);
    expect(groups[0].rates.map(rate => rate.modelName)).toEqual(['claude-opus-5-5', 'claude-sonnet-4-6']);
  });

  it('names a provider it has not met from its key', () => {
    expect(tokenRateProviderLabel('GOOGLE_GEMINI')).toBe('Google Gemini');
    expect(tokenRateProviderLabel('X_AI')).toBe('X Ai');
  });
});

describe('ModelTokenRates', () => {
  it('states the unit once and each model with its input and output rate', () => {
    render(<ModelTokenRates rates={RATES} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.caption)).toBeTruthy();
    const row = screen.getByRole('row', { name: /Claude Opus 5\.5/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    ).toEqual(['1.33×', '6.67×']);
    // No display name: the model's id stands in.
    expect(screen.getByRole('rowheader', { name: 'claude-sonnet-4-6' })).toBeTruthy();
    expect(screen.getByText('Anthropic')).toBeTruthy();
    expect(screen.getByText('OpenAI')).toBeTruthy();
  });

  it('adds the cached input column only where there is room for it', () => {
    const { unmount } = render(<ModelTokenRates rates={RATES} />);
    expect(screen.queryByText(MODEL_TOKEN_RATES_COPY.cached)).toBeNull();
    unmount();
    render(<ModelTokenRates rates={RATES} density="comfortable" />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.cached)).toBeTruthy();
    const cells = within(screen.getByRole('row', { name: /claude-sonnet-4-6/ })).getAllByRole('cell');
    expect(cells.map(cell => cell.textContent)).toEqual(['1×', '5×', TOKEN_RATE_EMPTY]);
  });

  it('says when the rates took effect, and nothing for a date it cannot read', () => {
    const { unmount } = render(<ModelTokenRates rates={RATES} effectiveFrom="2026-10-01T21:20:26.143Z" />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.effective('October 1, 2026'))).toBeTruthy();
    unmount();
    render(<ModelTokenRates rates={RATES} effectiveFrom="soon" />);
    expect(screen.queryByText(/Rates in effect/)).toBeNull();
  });

  it('keeps its frame and the auto top-up line while the rates load or fail', () => {
    const { rerender } = render(<ModelTokenRates status="loading" autoTopUpEnabled />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.autoTopUp.on)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    rerender(<ModelTokenRates status="error" autoTopUpEnabled={false} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.autoTopUp.off)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(MODEL_TOKEN_RATES_COPY.unavailable.title);
  });

  it('says so when no rate is in effect', () => {
    render(<ModelTokenRates rates={[]} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.empty)).toBeTruthy();
  });
});
