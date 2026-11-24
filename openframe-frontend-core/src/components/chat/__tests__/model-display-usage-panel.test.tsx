/**
 * The token counter opens the Usage panel when the host gives it one (Mingo), from the keyboard too, keeps focus where
 * it was, and closes on Esc. Without the panel's data the counter is the plain text it always was (Fae, tickets).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelDisplay } from '../model-display';
import type { ChatUsagePanelData } from '../usage/chat-usage';

const panel: ChatUsagePanelData = {
  free: { used: 3_200_000, total: 10_000_000 },
  balance: { tokens: 3_840_000, usd: 38.4, tone: 'default' },
  context: { used: null, limit: null, compactionThreshold: 0.8 },
  breakdown: { input: 1_200, cacheRead: 10_100, cacheWrite: 560, output: 940 },
};

describe('ModelDisplay usage panel', () => {
  it('stays plain text without the panel data', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" usedTokens={12_300} contextWindow={150_000} />);
    expect(screen.queryByRole('button', { name: /usage/i })).not.toBeInTheDocument();
  });

  it('is a button that names the figures', () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        usedTokens={12_840}
        contextWindow={150_000}
        usagePanel={panel}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Usage: 12,840 of 150,000 context budget tokens. Show usage details' }),
    ).toBeInTheDocument();
  });

  it('opens the panel, keeps focus on the trigger, and closes on Esc', async () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        usedTokens={12_840}
        contextWindow={150_000}
        usagePanel={panel}
      />,
    );
    // A native button: Enter and Space press it, so the keyboard opens the panel as a click does.
    const trigger = screen.getByRole('button', { name: /show usage details/i });
    trigger.focus();
    fireEvent.click(trigger);

    const group = await screen.findByRole('group', { name: 'Usage' });
    expect(group).toHaveTextContent('Free AI Tokens3.2M / 10M');
    expect(group).toHaveTextContent('Current AI Balance3.8M ($38.40)');
    expect(group).toHaveTextContent('Chat Context12,840 / 150,000');
    expect(group).toHaveTextContent('Mingo compacts chat memory at 80%');
    expect(group).toHaveTextContent('Cache Read10,100');
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Usage' })).not.toBeInTheDocument();
  });

  it('writes an unknown breakdown and unknown company figures as dashes', async () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        contextWindow={30_000}
        usagePanel={{ ...panel, free: null, balance: null, breakdown: null }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show usage details/i }));
    const group = await screen.findByRole('group', { name: 'Usage' });
    expect(group).toHaveTextContent('Free AI Tokens—');
    expect(group).toHaveTextContent('Chat Context— / 30,000');
    expect(group).toHaveTextContent('Input—');
  });

  it('draws no counter while the budget and the usage are both unknown (no chat, or a new chat before its first figures)', () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        usagePanel={{ ...panel, context: { used: null, limit: null, compactionThreshold: null } }}
      />,
    );
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.queryByText(/context budget/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show usage details/i })).not.toBeInTheDocument();
  });

  it('draws the counter once the budget is known, before the first usage', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" contextWindow={150_000} usagePanel={panel} />);
    expect(screen.getByRole('button', { name: /show usage details/i })).toHaveTextContent('—/150K context budget');
  });

  it('draws the counter once the usage is known, before the budget', () => {
    render(<ModelDisplay provider="anthropic" modelName="Claude" usedTokens={12_300} usagePanel={panel} />);
    expect(screen.getByRole('button', { name: /show usage details/i })).toHaveTextContent('12.3K/— context budget');
  });

  it("writes a compaction threshold the backend has not reported as a dash, never the design's 75% (a new chat)", async () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        contextWindow={150_000}
        usagePanel={{ ...panel, context: { used: null, limit: null, compactionThreshold: null } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show usage details/i }));
    const group = await screen.findByRole('group', { name: 'Usage' });
    expect(group).toHaveTextContent('Mingo compacts chat memory at —');
    expect(group).not.toHaveTextContent('75%');
  });

  it('writes a balance of a billion tokens or more in B, as Billing does', async () => {
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude"
        contextWindow={150_000}
        usagePanel={{ ...panel, balance: { tokens: 100_000_000_000, usd: 1_000_000, tone: 'default' } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show usage details/i }));
    const group = await screen.findByRole('group', { name: 'Usage' });
    expect(group).toHaveTextContent('Current AI Balance100B ($1,000,000.00)');
  });
});
