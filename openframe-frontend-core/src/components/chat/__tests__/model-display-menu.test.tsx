import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionsMenuItem } from '../../ui/actions-menu';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { ModelDisplay } from '../model-display';

const providers: ActionsMenuItem[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    type: 'submenu',
    submenuBoundary: 'viewport',
    submenu: [{ id: 'claude', label: 'Claude Alpha', type: 'radio', checked: true }],
  },
];

describe('ModelDisplay anchored menu', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 48));
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  });
  afterEach(() => vi.restoreAllMocks());

  it('closes the complete provider submenu when choices become busy and stays closed when reenabled', async () => {
    const onSelect = vi.fn();
    const items = providers.map(item => ({
      ...item,
      submenu: item.submenu?.map(model => ({ ...model, onClick: onSelect })),
    }));
    const { rerender } = render(<ModelDisplay modelName="Claude Alpha" modelMenuItems={items} />);
    const trigger = screen.getByRole('button', { name: 'Claude Alpha' });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    const provider = await screen.findByRole('menuitem', { name: 'Anthropic' });
    await waitFor(() => expect(provider).toHaveFocus());
    fireEvent.keyDown(provider, { key: 'ArrowRight' });
    await screen.findByRole('menuitemradio', { name: 'Claude Alpha' });
    rerender(
      <ModelDisplay modelName="Claude Alpha" modelMenuItems={items.map(item => ({ ...item, disabled: true }))} />,
    );
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toBeDisabled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    rerender(<ModelDisplay modelName="Claude Alpha" modelMenuItems={items} />);
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
  it('uses the existing model label as its real menu trigger and returns focus to it', async () => {
    const legacyClick = vi.fn();
    render(
      <ModelDisplay
        provider="anthropic"
        modelName="Claude Alpha"
        modelMenuItems={providers}
        onModelClick={legacyClick}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Claude Alpha' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    expect(await screen.findByRole('menuitem', { name: 'Anthropic' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Anthropic' }), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(legacyClick).not.toHaveBeenCalled();
  });

  it('does not reopen a stale menu when the host removes and restores the menu capability', async () => {
    const { rerender } = render(<ModelDisplay modelName="Claude Alpha" modelMenuItems={providers} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Claude Alpha' }), { button: 0, pointerType: 'mouse' });
    await screen.findByRole('menuitem', { name: 'Anthropic' });
    rerender(<ModelDisplay modelName="Claude Alpha" />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    rerender(<ModelDisplay modelName="Claude Alpha" modelMenuItems={providers} />);
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps usage details independent while a model menu is available', async () => {
    render(
      <ModelDisplay
        modelName="Claude Alpha"
        modelMenuItems={providers}
        usedTokens={1200}
        contextWindow={50000}
        usagePanel={{
          free: null,
          balance: null,
          breakdown: null,
          context: { used: 1200, limit: 50000, compactionThreshold: 0.8 },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Show usage details/ }));
    expect(await screen.findByRole('group', { name: 'Usage' })).toHaveTextContent('Chat Context1,200 / 50,000');
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the legacy settings click when the host supplies no menu', () => {
    const legacyClick = vi.fn();
    render(<ModelDisplay modelName="Claude Alpha" onModelClick={legacyClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Claude Alpha' }));
    expect(legacyClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables an unavailable menu and closes an open menu when all choices become unavailable', async () => {
    const { rerender } = render(<ModelDisplay modelName="Claude Alpha" modelMenuItems={providers} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Claude Alpha' }), { button: 0, pointerType: 'mouse' });
    await screen.findByRole('menuitem', { name: 'Anthropic' });
    rerender(
      <ModelDisplay modelName="Claude Alpha" modelMenuItems={providers.map(item => ({ ...item, disabled: true }))} />,
    );
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    rerender(<ModelDisplay modelName="Claude Alpha" modelMenuItems={[]} />);
    expect(screen.getByRole('button', { name: 'Claude Alpha' })).toBeDisabled();
  });
});

function delayedSave() {
  let resolve = () => {};
  let reject = (_error: Error) => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type DelayedSave = ReturnType<typeof delayedSave>;
function SavingModelHost({
  save,
  subject = 'chat-a',
  capability = true,
  loading = false,
}: {
  save: DelayedSave;
  subject?: string;
  capability?: boolean;
  loading?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('Claude Alpha');
  const [result, setResult] = useState('Ready');
  const applySuccessfulModelSave = () => {
    setName('Claude Beta');
    setResult('Saved');
  };
  const selectModel = async () => {
    setBusy(true);
    setResult('Saving');
    try {
      await save.promise;
      applySuccessfulModelSave();
    } catch {
      setResult('Save failed');
    } finally {
      setBusy(false);
    }
  };
  const items: ActionsMenuItem[] = [
    {
      id: 'anthropic',
      label: 'Anthropic',
      type: 'submenu',
      submenuBoundary: 'viewport',
      disabled: busy,
      submenu: [
        { id: 'alpha', label: 'Claude Alpha', type: 'radio', checked: name === 'Claude Alpha', disabled: busy },
        {
          id: 'beta',
          label: 'Claude Beta',
          type: 'radio',
          checked: name === 'Claude Beta',
          disabled: busy,
          onClick: () => {
            void selectModel();
          },
        },
      ],
    },
  ];
  return (
    <>
      <ModelDisplay
        modelName={name}
        modelMenuItems={capability ? items : undefined}
        modelMenuScopeKey={subject}
        loading={loading}
      />
      <Textarea aria-label="Reply to Mingo" />
      <Button type="button">Other action</Button>
      <p role="status">{result}</p>
    </>
  );
}

async function chooseModelWithKeyboard() {
  const trigger = screen.getByRole('button', { name: 'Claude Alpha' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const provider = await screen.findByRole('menuitem', { name: 'Anthropic' });
  await waitFor(() => expect(provider).toHaveFocus());
  await act(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      }),
  );
  fireEvent.keyDown(provider, { key: 'ArrowRight' });
  const alpha = await screen.findByRole('menuitemradio', { name: 'Claude Alpha' });
  await waitFor(() => expect(alpha).toHaveFocus());
  fireEvent.keyDown(alpha, { key: 'ArrowDown' });
  const beta = screen.getByRole('menuitemradio', { name: 'Claude Beta' });
  await waitFor(() => expect(beta).toHaveFocus());
  fireEvent.keyDown(beta, { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saving'));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Claude Alpha' })).toBeDisabled();
  return trigger;
}

async function settleModelSave(save: DelayedSave, outcome: 'success' | 'failure') {
  await act(async () => {
    if (outcome === 'success') save.resolve();
    else save.reject(new Error('Save unavailable'));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(outcome === 'success' ? 'Saved' : 'Save failed'),
  );
}

describe('ModelDisplay asynchronous model selection focus', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 48));
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['success', 'failure'] as const)(
    'returns focus to the same label after a delayed %s without reopening',
    async outcome => {
      const save = delayedSave();
      render(<SavingModelHost save={save} />);
      const originalTrigger = await chooseModelWithKeyboard();
      const busyTrigger = screen.getByRole('button', { name: 'Claude Alpha' });
      await settleModelSave(save, outcome);
      const trigger = screen.getByRole('button', { name: outcome === 'success' ? 'Claude Beta' : 'Claude Alpha' });
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toBe(originalTrigger);
      expect(busyTrigger).toBe(originalTrigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    },
  );

  it.each(['composer', 'other control'] as const)(
    'does not steal focus after the user moves to the %s during a save',
    async destination => {
      const save = delayedSave();
      render(<SavingModelHost save={save} />);
      await chooseModelWithKeyboard();
      const destinationControl =
        destination === 'composer'
          ? screen.getByRole('textbox', { name: 'Reply to Mingo' })
          : screen.getByRole('button', { name: 'Other action' });
      destinationControl.focus();
      await settleModelSave(save, 'success');
      expect(destinationControl).toHaveFocus();
    },
  );

  it('cancels pending return if the user moves to the composer and then back to neutral document focus', async () => {
    const save = delayedSave();
    render(<SavingModelHost save={save} />);
    await chooseModelWithKeyboard();
    const composer = screen.getByRole('textbox', { name: 'Reply to Mingo' });
    composer.focus();
    composer.blur();
    expect(document.body).toHaveFocus();
    await settleModelSave(save, 'success');
    expect(document.body).toHaveFocus();
  });

  it.each(['capability', 'loading', 'subject'] as const)(
    'cancels pending return when the %s changes before saving settles',
    async cancellation => {
      const save = delayedSave();
      const { rerender } = render(<SavingModelHost save={save} />);
      await chooseModelWithKeyboard();
      if (cancellation === 'capability') {
        rerender(<SavingModelHost save={save} capability={false} />);
        rerender(<SavingModelHost save={save} />);
      } else if (cancellation === 'loading') {
        rerender(<SavingModelHost save={save} loading />);
        rerender(<SavingModelHost save={save} />);
      } else {
        rerender(<SavingModelHost save={save} subject="chat-b" />);
        rerender(<SavingModelHost save={save} subject="chat-c" />);
      }
      await settleModelSave(save, 'success');
      expect(screen.getByRole('button', { name: 'Claude Beta' })).not.toHaveFocus();
      expect(document.body).toHaveFocus();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    },
  );
});
