import { describe, expect, it, vi } from 'vitest';
import { sourceMetadataEvent } from '../source-metadata';

describe('source metadata card provenance', () => {
  it('is recognized by a separate package entrypoint module instance', async () => {
    const event = sourceMetadataEvent({
      sources: [
        {
          index: 1,
          id: 'install-agent',
          name: 'Install the OpenFrame agent on Windows',
          path: 'getting-started/install-agent.md',
          documentType: 'markdown',
        },
      ],
      cards: [
        {
          ref: '[card://markdown:install-agent]',
          entityType: 'markdown',
          entityId: 'install-agent',
        },
      ],
    });
    const ref = event?.refs?.[0];
    if (!ref) throw new Error('Expected matching source metadata card ref');

    vi.resetModules();
    const { isSourceMetadataCardRef } = await import('../source-metadata');

    expect(isSourceMetadataCardRef(ref)).toBe(true);
  });

  it('does not recognize an arbitrary enriched card ref', async () => {
    vi.resetModules();
    const { isSourceMetadataCardRef } = await import('../source-metadata');

    expect(
      isSourceMetadataCardRef({
        type: 'markdown',
        id: 'unmatched-doc',
        title: 'Plausible but unmatched document',
        url: null,
        metadata: { path: 'docs/unmatched.md' },
      }),
    ).toBe(false);
  });
});
