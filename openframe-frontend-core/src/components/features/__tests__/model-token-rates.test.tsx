import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  formatTokenAmount,
  formatTokenRate,
  formatTokenRateNumber,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  TOKEN_RATE_EMPTY,
  tokensForBalance,
  tokenRateProviderLabel,
} from '../../../utils/model-token-rates';
import { MODEL_TOKEN_RATES_COPY, ModelTokenExchange, ModelTokenRates } from '../model-token-rates';

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

describe('what a balance runs', () => {
  it('is the balance divided by the rate', () => {
    expect(tokensForBalance(1_000_000, 1.3333)).toBeCloseTo(750_019, 0);
    expect(tokensForBalance(1_000_000, 0.5)).toBe(2_000_000);
  });

  it('is not worked out without a rate or a balance', () => {
    expect(tokensForBalance(1_000_000, null)).toBeNull();
    expect(tokensForBalance(1_000_000, 0)).toBeNull();
    expect(tokensForBalance(0, 1)).toBeNull();
  });

  it('writes a token count in short form and a rate as a plain number', () => {
    expect(formatTokenAmount(850)).toBe('850');
    expect(formatTokenAmount(750_019)).toBe('750K');
    expect(formatTokenAmount(1_250_000)).toBe('1.25M');
    expect(formatTokenAmount(null)).toBe(TOKEN_RATE_EMPTY);
    expect(formatTokenRateNumber(1.3333)).toBe('1.33');
    expect(formatTokenRateNumber(0.0667)).toBe('0.067');
    expect(formatTokenRateNumber(undefined)).toBe(TOKEN_RATE_EMPTY);
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

describe('ModelTokenExchange (a page)', () => {
  const copy = MODEL_TOKEN_RATES_COPY.exchange;

  it('shows the first model: what a token of it charges, and what a million OpenFrame tokens run on it', () => {
    render(<ModelTokenExchange rates={RATES} />);
    expect(screen.getByRole('combobox', { name: copy.pick }).textContent).toContain('Claude Opus 5.5');
    // 1 input token = 1.33, 1 output token = 6.67, 1 cached input token = 0.067 OpenFrame tokens.
    expect(screen.getByText(copy.input)).toBeTruthy();
    expect(screen.getByText('1.33')).toBeTruthy();
    expect(screen.getByText('6.67')).toBeTruthy();
    expect(screen.getByText('0.067')).toBeTruthy();
    // 1M OpenFrame tokens run 750K input tokens, or 150K output tokens.
    expect(screen.getByText('1M')).toBeTruthy();
    expect(screen.getByText(copy.buys)).toBeTruthy();
    expect(screen.getByText('750K')).toBeTruthy();
    expect(screen.getByText(copy.orOutput('150K'))).toBeTruthy();
  });

  it('works the exchange out for the balance and caption the host names', () => {
    render(<ModelTokenExchange rates={RATES} balance={10_000_000} balanceCaption="included every month" />);
    expect(screen.getByText('10M')).toBeTruthy();
    expect(screen.getByText('included every month')).toBeTruthy();
    expect(screen.getByText('7.5M')).toBeTruthy();
    expect(screen.getByText(copy.orOutput('1.5M'))).toBeTruthy();
  });

  it('states no figure for a rate the model does not have', () => {
    render(<ModelTokenExchange rates={[RATES[2]]} />);
    expect(screen.getByText(copy.cached)).toBeTruthy();
    expect(screen.getByText(TOKEN_RATE_EMPTY)).toBeTruthy();
  });

  it('keeps its frame while loading, and says why when the rates fail or none is in effect', () => {
    const { rerender } = render(<ModelTokenExchange status="loading" />);
    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<ModelTokenExchange status="error" />);
    expect(screen.getByRole('alert').textContent).toContain(MODEL_TOKEN_RATES_COPY.unavailable.title);
    rerender(<ModelTokenExchange rates={[]} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.empty)).toBeTruthy();
  });
});
