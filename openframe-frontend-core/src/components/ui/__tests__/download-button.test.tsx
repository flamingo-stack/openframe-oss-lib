import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DownloadButton } from '../download-button';

describe('DownloadButton', () => {
  it('with an href it is a link that opens the file in a new tab', () => {
    render(<DownloadButton label="Download PDF" href="/api/trust-center/pdf" />);
    const link = screen.getByRole('link', { name: 'Download PDF' });
    expect(link).toHaveAttribute('href', '/api/trust-center/pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('with an onClick the host downloads the file itself', () => {
    const onClick = vi.fn();
    render(<DownloadButton label="Download PDF" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is the regular small ghost button unless the host says otherwise', () => {
    const { rerender } = render(<DownloadButton label="Download PDF" onClick={() => {}} />);
    const regular = screen.getByRole('button', { name: 'Download PDF' }).className;
    rerender(<DownloadButton label="Download PDF" variant="outline" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Download PDF' }).className).not.toBe(regular);
  });
});
