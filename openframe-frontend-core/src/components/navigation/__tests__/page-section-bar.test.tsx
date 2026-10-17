/**
 * The section bar shows a tab only for a section that rendered: a section whose
 * anchor element is empty (it left itself out) has no tab, including when it
 * empties itself after the page mounted.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageSectionBar } from '../page-section-bar';

const SECTIONS = [
  { id: 'kept', label: 'Kept' },
  { id: 'left-out', label: 'Left out' },
];

function Page({ secondHasContent }: { secondHasContent: boolean }) {
  return (
    <>
      <PageSectionBar sections={SECTIONS} />
      <div id="kept">
        <section>Kept section</section>
      </div>
      <div id="left-out">{secondHasContent && <section>Its content</section>}</div>
    </>
  );
}

describe('PageSectionBar', () => {
  it('leaves out the tab of a section that rendered nothing', async () => {
    render(<Page secondHasContent={false} />);
    await waitFor(() => expect(screen.queryByText('Left out')).not.toBeInTheDocument());
    expect(screen.getByText('Kept')).toBeInTheDocument();
  });

  it('drops a tab when its section empties itself after mount', async () => {
    const { rerender } = render(<Page secondHasContent />);
    expect(screen.getByText('Left out')).toBeInTheDocument();
    await act(async () => rerender(<Page secondHasContent={false} />));
    await waitFor(() => expect(screen.queryByText('Left out')).not.toBeInTheDocument());
  });
});
