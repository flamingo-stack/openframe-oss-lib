import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComposerDockHeightContext } from '../../navigation/app-layout-context';
import { ChatContextMemoryBar } from '../chat-context-memory-bar';
import { ComposerSheet, type ComposerSheetProps } from '../composer-sheet';
import { MingoChatHeader } from '../mingo-chat-header';

function sheet(props: Partial<ComposerSheetProps> = {}) {
  return (
    <ComposerSheet
      open
      onDismiss={() => undefined}
      height={null}
      onHeightChange={() => undefined}
      aria-label="Mingo chat"
      {...props}
    >
      <p>thread</p>
    </ComposerSheet>
  );
}

describe('ComposerSheet', () => {
  it('draws nothing while closed', () => {
    render(sheet({ open: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('thread')).not.toBeInTheDocument();
  });

  it('is a named modal dialog holding what the host puts in it', () => {
    render(sheet());
    const dialog = screen.getByRole('dialog', { name: 'Mingo chat' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('thread')).toBeInTheDocument();
  });

  it('is a card with its border and rounding on every side, its content from the top border', () => {
    render(sheet());
    const card = screen.getByTestId('composer-sheet-card');
    expect(card).toHaveClass('rounded-md', 'border', 'overflow-hidden');
    expect(card).not.toHaveClass('rounded-t-md', 'border-b-0', 'pt-3');
    expect(within(card).getByText('thread')).toBeInTheDocument();
  });

  it('resizes from a tab standing on its top edge, and resets on a double click', () => {
    const onResetHeight = vi.fn();
    render(sheet({ onResetHeight }));
    const tab = screen.getByTestId('composer-sheet-tab');
    const handle = within(tab).getByRole('separator', { name: 'Resize the chat' });
    expect(handle).toHaveClass('cursor-row-resize');
    expect(within(screen.getByTestId('composer-sheet-card')).queryByRole('separator')).not.toBeInTheDocument();
    fireEvent.doubleClick(handle);
    expect(onResetHeight).toHaveBeenCalledTimes(1);
  });

  it('keeps the tab inside the layer at its full height', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
    render(sheet({ height: 2000 }));
    const handle = screen.getByRole('separator', { name: 'Resize the chat' });
    expect(handle).toHaveAttribute('aria-valuemax', '780');
    expect(handle).toHaveAttribute('aria-valuenow', '780');
    vi.restoreAllMocks();
  });

  it('runs its scrim on under the composer dock, by the dock height AppLayout hands it', () => {
    render(<ComposerDockHeightContext.Provider value={120}>{sheet()}</ComposerDockHeightContext.Provider>);
    expect(screen.getByTestId('composer-sheet-scrim')).toHaveStyle({ bottom: '-120px' });
  });

  it('hands a scrim click to the host', () => {
    const onDismiss = vi.fn();
    render(sheet({ onDismiss }));
    // The scrim is an aria-hidden box: no role reaches it.
    fireEvent.click(screen.getByTestId('composer-sheet-scrim'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps a click inside the sheet from dismissing it', () => {
    const onDismiss = vi.fn();
    render(sheet({ onDismiss }));
    fireEvent.click(screen.getByText('thread'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('draws the height it is given before the layer is measured, not the floor', () => {
    // jsdom lays nothing out: the layer measures 0, as an open sheet's first frame does.
    render(sheet({ height: 500 }));
    expect(screen.getByRole('dialog', { name: 'Mingo chat' })).toHaveStyle({ height: '500px' });
  });

  it('eases no change of its height: a drag must follow the pointer', () => {
    render(sheet());
    expect(screen.getByRole('dialog', { name: 'Mingo chat' }).className).not.toMatch(/(?:^|\s)duration-/);
  });

  it('resizes from the keyboard, never under its floor', () => {
    const onHeightChange = vi.fn();
    render(sheet({ height: 330, onHeightChange, minHeight: 320 }));
    const grip = screen.getByRole('separator', { name: 'Resize the chat' });
    // jsdom lays nothing out: the layer measures 0, so the floor is also the ceiling.
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(onHeightChange).toHaveBeenLastCalledWith(320);
    fireEvent.keyDown(grip, { key: 'Home' });
    expect(onHeightChange).toHaveBeenLastCalledWith(320);
  });
});

describe('ChatContextMemoryBar leading', () => {
  it('shows the leading control alone when nothing is remembered', () => {
    render(<ChatContextMemoryBar items={[]} leading={<button type="button">Continue chat</button>} />);
    expect(screen.getByRole('button', { name: 'Continue chat' })).toBeInTheDocument();
    expect(screen.queryByText(/in context/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show remembered context' })).not.toBeInTheDocument();
  });

  it('leads the summary when something is remembered', () => {
    render(
      <ChatContextMemoryBar
        items={[{ type: 'DEVICE', id: 'd-1', label: 'MacBook' }]}
        leading={<button type="button">Continue chat</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Continue chat' })).toBeInTheDocument();
    expect(screen.getByText('1 recently viewed item in context')).toBeInTheDocument();
  });

  it('still renders nothing with neither', () => {
    const { container } = render(<ChatContextMemoryBar items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MingoChatHeader actions', () => {
  it('draws each action as a named cell after the menu and runs it', () => {
    const onFull = vi.fn();
    const onBack = vi.fn();
    render(
      <MingoChatHeader
        variant="page"
        title="Disk cleanup"
        actions={[
          { id: 'full', label: 'Open as full chat', icon: <span />, onClick: onFull },
          { id: 'back', label: 'Back to page', icon: <span />, onClick: onBack },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open as full chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to page' }));
    expect(onFull).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
