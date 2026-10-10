import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatTokenAmount,
  formatTokenRate,
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

  it('writes a token count in short form', () => {
    expect(formatTokenAmount(850)).toBe('850');
    expect(formatTokenAmount(750_019)).toBe('750K');
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

describe('ModelTokenExchange (a page)', () => {
  const copy = MODEL_TOKEN_RATES_COPY.exchange;
  const [OPUS, LUNA] = RATES;
  const PROVIDERS = ['ANTHROPIC', 'OPENAI'];

  const TEN_PER_MILLION = { tokens: 1_000_000, price: 10 };

  it('says the whole idea in three steps: buy OpenFrame tokens, use a model, pay its exchange rate', () => {
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={RATES}
        providers={PROVIDERS}
        provider="ANTHROPIC"
        tokenPrice={TEN_PER_MILLION}
      />,
    );
    // 1. What is bought, and for how much.
    expect(screen.getByRole('heading', { name: copy.buy.title })).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText(copy.buy.words('1M'))).toBeTruthy();
    // 2. The model it is spent on.
    expect(screen.getByRole('heading', { name: copy.use.title })).toBeTruthy();
    // 3. The rate, and (most prominent) what the money buys at it.
    expect(screen.getByRole('heading', { name: copy.charge.title })).toBeTruthy();
    expect(screen.getByText('1.33×')).toBeTruthy();
    expect(screen.getByText(copy.charge.unit)).toBeTruthy();
    expect(screen.getByText(copy.charge.input)).toBeTruthy();
    expect(screen.getByText('6.67×')).toBeTruthy();
    expect(screen.getByText(copy.charge.so('$10.00', 'Claude Opus 5.5'))).toBeTruthy();
    expect(screen.getByText('750K')).toBeTruthy();
    expect(screen.getByText(copy.charge.read)).toBeTruthy();
    expect(screen.getByText(copy.charge.orWritten('150K'))).toBeTruthy();
  });

  it('is a calculator: moving the amount reprices step 1 and reworks the answer in step 3', () => {
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={RATES}
        providers={PROVIDERS}
        provider="ANTHROPIC"
        tokenPrice={TEN_PER_MILLION}
      />,
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5000000' } });
    expect(screen.getByText('$50.00')).toBeTruthy();
    expect(screen.getByText(copy.buy.words('5M'))).toBeTruthy();
    expect(screen.getByText(copy.charge.so('$50.00', 'Claude Opus 5.5'))).toBeTruthy();
    expect(screen.getByText('3.75M')).toBeTruthy();
    expect(screen.getByText(copy.charge.read)).toBeTruthy();
    expect(screen.getByText(copy.charge.orWritten('750K'))).toBeTruthy();
  });

  it('offers what the plan includes as one-tap amounts', () => {
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={RATES}
        providers={PROVIDERS}
        provider="ANTHROPIC"
        tokenPrice={TEN_PER_MILLION}
        presets={[{ tokens: 10_000_000, label: 'every month' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.buy.preset('10M', 'every month') }));
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('7.5M')).toBeTruthy();
    expect(screen.getByText(copy.charge.read)).toBeTruthy();
  });

  it('states the tokens alone when it is not told what they cost', () => {
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={RATES}
        providers={PROVIDERS}
        provider="ANTHROPIC"
        defaultAmount={10_000_000}
      />,
    );
    expect(screen.getByText(copy.buy.unit)).toBeTruthy();
    expect(screen.getByText(copy.charge.so(copy.buy.tokens('10M'), 'Claude Opus 5.5'))).toBeTruthy();
    expect(screen.getByText('7.5M')).toBeTruthy();
    expect(screen.getByText(copy.charge.read)).toBeTruthy();
  });

  it('chooses the provider with push buttons, and never clears the choice', () => {
    const onProviderChange = vi.fn();
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={RATES}
        providers={PROVIDERS}
        provider="ANTHROPIC"
        onProviderChange={onProviderChange}
      />,
    );
    fireEvent.click(screen.getByText('OpenAI'));
    expect(onProviderChange).toHaveBeenCalledWith('OPENAI');
    onProviderChange.mockClear();
    fireEvent.click(screen.getByText('Anthropic'));
    expect(onProviderChange).not.toHaveBeenCalledWith(undefined);
  });

  it("searches on the host: what is typed is handed over, and the options are exactly the host's answer", () => {
    const onQueryChange = vi.fn();
    const onPick = vi.fn();
    render(
      <ModelTokenExchange
        rate={OPUS}
        models={[LUNA]}
        providers={PROVIDERS}
        provider="OPENAI"
        query=""
        onQueryChange={onQueryChange}
        onPick={onPick}
      />,
    );
    const input = screen.getByPlaceholderText(copy.use.search);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'luna' } });
    expect(onQueryChange).toHaveBeenLastCalledWith('luna');
    // "claude-sonnet-4-6" is not in the host's answer, so it is not offered: the picker filters nothing itself.
    expect(screen.queryByRole('option', { name: /claude-sonnet-4-6/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /GPT-6 Luna/ }));
    expect(onPick).toHaveBeenCalledWith('gpt-6-luna');
  });

  it('keeps its three steps while loading, and says why when the rate fails or none is in effect', () => {
    const { rerender } = render(<ModelTokenExchange status="loading" />);
    expect(screen.getAllByRole('heading')).toHaveLength(3);
    expect(screen.queryByText(/×/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<ModelTokenExchange status="error" />);
    expect(screen.getByRole('alert').textContent).toContain(MODEL_TOKEN_RATES_COPY.unavailable.title);
    rerender(<ModelTokenExchange rate={null} />);
    expect(screen.getByText(MODEL_TOKEN_RATES_COPY.empty)).toBeTruthy();
  });
});
