import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FigmaEmbed } from '../figma-embed';
import { GoogleSheetsViewer } from '../google-sheets-viewer';
import { PdfViewer } from '../pdf-viewer';

/**
 * Output-parity pins for the `EmbedViewerFrame` extraction (the merge gate):
 * the structural markers each PRE-extraction viewer rendered must survive the
 * refactor byte-for-byte — wrapper spacing, title element + classes, action
 * containers, empty-state shapes, iframe attributes — plus the one behavior
 * that motivated the "prove it first" requirement: figma's STATEFUL
 * present/browse ToggleGroup working through the frame's plain-ReactNode
 * `actions` slot.
 */
describe('EmbedViewerFrame parity', () => {
  it('GoogleSheetsViewer: h2.text-h3 title, ODS-spaced wrapper, one action button, iframe src', () => {
    const { container } = render(
      <GoogleSheetsViewer externalUrl="https://docs.google.com/spreadsheets/d/ABC123/edit" fileName="Budget" />,
    );
    // The wrapper is `space-y-[var(--spacing-system-mf)]` (16px, the ODS token
    // for the old raw `space-y-4`) — see ODS_TOKEN_RULES.md; the FigmaEmbed
    // case below still asserts caller spacing wins over it via tailwind-merge.
    expect(container.firstElementChild?.className).toContain('space-y-[var(--spacing-system-mf)]');
    const title = container.querySelector('h2');
    expect(title?.className).toContain('text-h3');
    expect(title?.textContent).toBe('Budget');
    expect(screen.getByText('Open in Google Sheets')).toBeTruthy();
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('docs.google.com');
  });

  it('GoogleSheetsViewer: empty URL renders the standalone header-less empty state', () => {
    const { container } = render(<GoogleSheetsViewer externalUrl="" />);
    expect(container.querySelector('h2')).toBeNull();
    expect(screen.getByText('Google Sheet URL not configured')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('PdfViewer: two actions in their own container, callbacks preferred over hrefs', () => {
    let previewed = 0;
    const { container } = render(
      <PdfViewer src="https://x.test/doc.pdf" fileName="Deck" onPreview={() => previewed++} />,
    );
    const title = container.querySelector('h2');
    expect(title?.className).toContain('text-h3');
    fireEvent.click(screen.getByText('Preview'));
    expect(previewed).toBe(1);
    // Download has no callback → renders as a link to the src.
    const download = screen.getByText('Download').closest('a');
    expect(download?.getAttribute('href')).toBe('https://x.test/doc.pdf');
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://x.test/doc.pdf');
  });

  it('FigmaEmbed: my-6 space-y-3 wrapper, span.text-h6 title, allow/fullscreen on the iframe', () => {
    const { container } = render(<FigmaEmbed url="https://www.figma.com/design/abc/My-File" title="Spec" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('my-6');
    expect(wrapper?.className).toContain('space-y-3');
    expect(wrapper?.className).not.toContain('space-y-4'); // tailwind-merge: caller spacing wins
    expect(container.querySelector('h2')).toBeNull();
    const title = Array.from(container.querySelectorAll('span')).find(s => s.textContent === 'Spec');
    expect(title?.className).toContain('text-h6');
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('allow')).toContain('clipboard-write');
    // Historical behavior pinned: EmbedIframe DROPS allowFullScreen when
    // `allow` already grants fullscreen (embed-iframe.tsx:96), so the
    // attribute was absent pre-extraction too.
    expect(iframe?.getAttribute('allow')).toContain('fullscreen');
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(false);
  });

  it('FigmaEmbed: empty URL keeps NO iframe and shows the figma empty message', () => {
    const { container } = render(<FigmaEmbed url="" />);
    expect(screen.getByText('Figma URL not configured')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('FigmaEmbed slides: the STATEFUL ToggleGroup works through the actions slot and swaps the iframe src', () => {
    const { container } = render(<FigmaEmbed url="https://www.figma.com/slides/abc/My-Deck" title="Deck" />);
    const srcBefore = container.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(screen.getByLabelText('Figma slides view mode')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Browse'));
    const srcAfter = container.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(srcAfter).not.toBe(srcBefore); // view flip recomputes embedSrc → EmbedIframe remounts on new src
    // Flip back — state survives round trips (it lives in FigmaEmbed, not the slot).
    fireEvent.click(screen.getByLabelText('Present'));
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(srcBefore);
  });
});
