import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ViewportBreakpoints } from '../../../hooks/ui/use-content-breakpoint';
import { ColumnBackSlot, useColumnBack } from '../column-back-slot';
import { TitleBlock } from '../title-block';

/**
 * A work-area page column whose header draws the page's Back (CU-17tkuw670yr): the
 * page's `TitleBlock` hands its `backButton` to the header, so the page has one Back
 * at every width; outside a slot nothing changes.
 */
function HeaderBack() {
  const back = useColumnBack();
  return back ? (
    <button type="button" onClick={back.onClick}>
      header {back.label ?? 'Back'}
    </button>
  ) : (
    <span>no header back</span>
  );
}

describe('ColumnBackSlot', () => {
  it('outside a slot, the title block draws its own Back', () => {
    render(<TitleBlock title="Recording" backButton={{ label: 'Back', onClick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });

  it('inside a slot, the Back is handed to the header and not drawn in the page', () => {
    const onClick = vi.fn();
    render(
      <ColumnBackSlot>
        <HeaderBack />
        <TitleBlock title="Recording" backButton={{ label: 'Back to device', onClick }} />
      </ColumnBackSlot>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'header Back to device' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a disabled slot changes nothing', () => {
    render(
      <ColumnBackSlot enabled={false}>
        <HeaderBack />
        <TitleBlock title="Recording" backButton={{ label: 'Back', onClick: vi.fn() }} />
      </ColumnBackSlot>,
    );
    expect(screen.getByText('no header back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });

  it('a page without a Back leaves the header without one', () => {
    render(
      <ColumnBackSlot>
        <HeaderBack />
        <TitleBlock title="Devices" />
      </ColumnBackSlot>,
    );
    expect(screen.getByText('no header back')).toBeInTheDocument();
  });

  it('the Back goes when its page goes', () => {
    function Page() {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown(false)}>
            leave
          </button>
          {shown && <TitleBlock title="Recording" backButton={{ onClick: vi.fn() }} />}
        </>
      );
    }
    render(
      <ColumnBackSlot>
        <HeaderBack />
        <Page />
      </ColumnBackSlot>,
    );
    expect(screen.getByRole('button', { name: 'header Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'leave' }));
    expect(screen.getByText('no header back')).toBeInTheDocument();
  });

  it('runs the latest handler without registering again on every render', () => {
    const calls: string[] = [];
    function Page() {
      const [n, setN] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setN(v => v + 1)}>
            rerender
          </button>
          {/* A new function each render, as most pages pass it. */}
          <TitleBlock title="Recording" backButton={{ onClick: () => calls.push(`render ${n}`) }} />
        </>
      );
    }
    render(
      <ColumnBackSlot>
        <HeaderBack />
        <Page />
      </ColumnBackSlot>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'rerender' }));
    fireEvent.click(screen.getByRole('button', { name: 'rerender' }));
    fireEvent.click(screen.getByRole('button', { name: 'header Back' }));
    expect(calls).toEqual(['render 2']);
  });

  it('window chrome opened from the column keeps its own Back', () => {
    render(
      <ColumnBackSlot>
        <HeaderBack />
        <ViewportBreakpoints>
          <TitleBlock title="In a modal" backButton={{ label: 'Back', onClick: vi.fn() }} />
        </ViewportBreakpoints>
      </ColumnBackSlot>,
    );
    expect(screen.getByText('no header back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
  });

  it('turning the slot off gives the page its own Back again', () => {
    function Host() {
      const [enabled, setEnabled] = useState(true);
      return (
        <ColumnBackSlot enabled={enabled}>
          <button type="button" onClick={() => setEnabled(false)}>
            one column
          </button>
          <HeaderBack />
          <TitleBlock title="Recording" backButton={{ label: 'Back', onClick: vi.fn() }} />
        </ColumnBackSlot>
      );
    }
    render(<Host />);
    expect(screen.getByRole('button', { name: 'header Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'one column' }));
    expect(screen.getByText('no header back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Back$/ })).toBeInTheDocument();
  });
});
