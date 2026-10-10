import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  formatTokenAmount,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  TOKEN_RATE_EMPTY,
  tokenRateExampleCost,
  tokenRateProviderLabel,
} from '../../../utils/model-token-rates';
import { MODEL_TOKEN_RATES_COPY, ModelTokenRateCards, ModelTokenRates } from '../model-token-rates';

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

describe('the example request', () => {
  it('uses what it reads at the input rate plus what it writes at the output rate', () => {
    expect(tokenRateExampleCost({ inputTokenRate: 1, outputTokenRate: 5 })).toBe(15_000);
    expect(tokenRateExampleCost({ inputTokenRate: 1.3333, outputTokenRate: 6.6667 })).toBeCloseTo(20_000, 0);
    expect(
      tokenRateExampleCost({ inputTokenRate: 2, outputTokenRate: 4 }, { inputTokens: 100, outputTokens: 10 }),
    ).toBe(240);
  });

  it('is not worked out without both rates', () => {
    expect(tokenRateExampleCost({ inputTokenRate: 0, outputTokenRate: 5 })).toBeNull();
    expect(tokenRateExampleCost({ inputTokenRate: 1, outputTokenRate: Number.NaN })).toBeNull();
  });

  it('writes a token count in short form', () => {
    expect(formatTokenAmount(850)).toBe('850');
    expect(formatTokenAmount(10_000)).toBe('10K');
    expect(formatTokenAmount(16_667)).toBe('16.7K');
    expect(formatTokenAmount(1_250_000)).toBe('1.25M');
    expect(formatTokenAmount(null)).toBe(TOKEN_RATE_EMPTY);
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

describe('ModelTokenRates (the popover table)', () => {
  it('shows one provider at a time, the first one first, and states the unit once', () => {
    render(<ModelTokenRates rates={RATES} />);
    expect(screen.getByRole('table', { name: MODEL_TOKEN_RATES_COPY.unit })).toBeTruthy();
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.unit)).toBeTruthy();
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

describe('ModelTokenRateCards (a page)', () => {
  // Slides off the first position are hidden from assistive tech, so cards are read with `hidden`.
  const cards = () => screen.queryAllByRole('article', { hidden: true });
  const card = (name: string) => screen.getByRole('article', { name, hidden: true });

  it('is one card per model of the provider shown, each with its three rates and the example worked out', () => {
    render(<ModelTokenRateCards rates={RATES} />);
    expect(cards()).toHaveLength(2);
    const opus = card('Claude Opus 5.5');
    expect(within(opus).getByText('1.33×')).toBeTruthy();
    expect(within(opus).getByText('6.67×')).toBeTruthy();
    expect(within(opus).getByText('0.067×')).toBeTruthy();
    expect(within(opus).getByText(MODEL_TOKEN_RATES_COPY.example('10K', '1K'))).toBeTruthy();
    expect(within(opus).getByText(MODEL_TOKEN_RATES_COPY.exampleCost('20K'))).toBeTruthy();
    // A model with no cached rate states none.
    expect(within(card('claude-sonnet-4-6')).getByText(TOKEN_RATE_EMPTY)).toBeTruthy();
  });

  it('switches provider from its tabs and starts that provider at its first model', () => {
    render(<ModelTokenRateCards rates={RATES} />);
    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }));
    expect(cards()).toHaveLength(1);
    expect(within(card('GPT-6 Luna')).getByText(MODEL_TOKEN_RATES_COPY.exampleCost('500'))).toBeTruthy();
  });

  it('never advances by itself: it has no play or pause control', () => {
    render(<ModelTokenRateCards rates={RATES} />);
    expect(screen.queryByRole('button', { name: /pause|play/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('holds its place while loading, and says why when the rates fail or none is in effect', () => {
    const { rerender } = render(<ModelTokenRateCards status="loading" />);
    expect(cards()).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<ModelTokenRateCards status="error" />);
    expect(screen.getByRole('alert').textContent).toContain(MODEL_TOKEN_RATES_COPY.unavailable.title);
    rerender(<ModelTokenRateCards rates={[]} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.empty)).toBeTruthy();
  });
});
