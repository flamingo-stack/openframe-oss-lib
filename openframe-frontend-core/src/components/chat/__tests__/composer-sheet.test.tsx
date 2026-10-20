import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
