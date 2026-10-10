import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  formatTokenPrice,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  TOKEN_RATE_EMPTY,
  tokenRatePrice,
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

const cellsOf = (name: RegExp) =>
  within(screen.getByRole('row', { name }))
    .getAllByRole('cell')
    .map(cell => cell.textContent);

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

describe('a price per million tokens', () => {
  const TEN_PER_MILLION = { tokens: 1_000_000, price: 10 };

  it('is the rate times what a million OpenFrame tokens cost', () => {
    expect(tokenRatePrice(1.3333, TEN_PER_MILLION)).toBeCloseTo(13.333);
    expect(tokenRatePrice(1, { tokens: 500_000, price: 10 })).toBe(20);
  });

  it('is not stated without a rate or without a price', () => {
    expect(tokenRatePrice(null, TEN_PER_MILLION)).toBeNull();
    expect(tokenRatePrice(1, null)).toBeNull();
    expect(tokenRatePrice(1, { tokens: 0, price: 10 })).toBeNull();
  });

  it('is written to the cent, and a price under ten cents keeps two significant digits', () => {
    expect(formatTokenPrice(13.333)).toBe('$13.33');
    expect(formatTokenPrice(5)).toBe('$5.00');
    expect(formatTokenPrice(0.333)).toBe('$0.33');
    expect(formatTokenPrice(0.0333)).toBe('$0.033');
    expect(formatTokenPrice(null)).toBe(TOKEN_RATE_EMPTY);
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
  it('shows one provider at a time, the first one first, and states the unit once', () => {
    render(<ModelTokenRates rates={RATES} />);
    expect(screen.getByRole('table', { name: MODEL_TOKEN_RATES_COPY.unit.rate })).toBeTruthy();
    expect(cellsOf(/Claude Opus 5\.5/)).toEqual(['1.33×', '6.67×']);
    // No display name: the model's id stands in.
    expect(screen.getByRole('rowheader', { name: 'claude-sonnet-4-6' })).toBeTruthy();
    expect(screen.queryByText('GPT-6 Luna')).toBeNull();
  });

  it('switches provider from its tabs', () => {
    render(<ModelTokenRates rates={RATES} />);
    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }));
    expect(cellsOf(/GPT-6 Luna/)).toEqual(['0.033×', '0.17×']);
    expect(screen.queryByText('Claude Opus 5.5')).toBeNull();
  });

  it('shows no tabs for a single provider', () => {
    render(<ModelTokenRates rates={RATES.filter(rate => rate.providerType === 'OPENAI')} />);
    expect(screen.queryByRole('button', { name: 'OpenAI' })).toBeNull();
    expect(screen.getByText('GPT-6 Luna')).toBeTruthy();
  });

  it('adds the cached input column only where there is room for it', () => {
    const { unmount } = render(<ModelTokenRates rates={RATES} />);
    expect(screen.queryByText(MODEL_TOKEN_RATES_COPY.cached)).toBeNull();
    unmount();
    render(<ModelTokenRates rates={RATES} density="comfortable" />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.cached)).toBeTruthy();
    expect(cellsOf(/claude-sonnet-4-6/)).toEqual(['1×', '5×', TOKEN_RATE_EMPTY]);
  });

  it('given what OpenFrame tokens cost, states every figure in USD per million model tokens', () => {
    render(<ModelTokenRates rates={RATES} density="comfortable" tokenPrice={{ tokens: 1_000_000, price: 10 }} />);
    expect(screen.getByRole('table', { name: MODEL_TOKEN_RATES_COPY.unit.price })).toBeTruthy();
    expect(cellsOf(/Claude Opus 5\.5/)).toEqual(['$13.33', '$66.67', '$0.67']);
  });

  it('says when the rates took effect, and nothing for a date it cannot read', () => {
    const { unmount } = render(<ModelTokenRates rates={RATES} effectiveFrom="2026-10-01T21:20:26.143Z" />);
    expect(
      screen.getByText(`${MODEL_TOKEN_RATES_COPY.unit.rate}. ${MODEL_TOKEN_RATES_COPY.effective('October 1, 2026')}.`),
    ).toBeTruthy();
    unmount();
    render(<ModelTokenRates rates={RATES} effectiveFrom="soon" />);
    expect(screen.queryByText(/In effect since/)).toBeNull();
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.unit.rate)).toBeTruthy();
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
