import { render } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { RichMarkdownRuntimeProvider, useRichMarkdownRuntime } from '../rich-markdown-runtime';

/**
 * `RichMarkdownRenderer` mounts its own provider around every document. That inner provider must keep the host's
 * runtime for whatever it is not given: filling from the defaults dropped the host's `transformImageSrc`, so every
 * in-article image's size probe downloaded the full original file.
 */
type Runtime = ReturnType<typeof useRichMarkdownRuntime>;

function Probe({ onRuntime }: { onRuntime: (r: Runtime) => void }) {
  onRuntime(useRichMarkdownRuntime());
  return null;
}

/** What a `Probe` rendered inside `tree` read from the runtime. */
function runtimeSeenIn(tree: (probe: React.ReactNode) => React.ReactElement): Runtime {
  let seen: Runtime | null = null;
  render(tree(<Probe onRuntime={r => (seen = r)} />));
  if (!seen) throw new Error('the probe did not render');
  return seen;
}

describe('RichMarkdownRuntimeProvider', () => {
  it('inherits the outer provider for every prop it is not given', () => {
    const hostTransform = (src: string) => `${src}?resized`;
    const seen = runtimeSeenIn(probe => (
      <RichMarkdownRuntimeProvider transformImageSrc={hostTransform} redditProxyUrl="/host/reddit">
        <RichMarkdownRuntimeProvider ogScraperUrl="/inner/og">{probe}</RichMarkdownRuntimeProvider>
      </RichMarkdownRuntimeProvider>
    ));
    expect(seen.transformImageSrc('a.png', {})).toBe('a.png?resized');
    expect(seen.redditProxyUrl).toBe('/host/reddit');
    expect(seen.ogScraperUrl).toBe('/inner/og');
  });

  it('falls back to the defaults with no provider above', () => {
    const seen = runtimeSeenIn(probe => <RichMarkdownRuntimeProvider>{probe}</RichMarkdownRuntimeProvider>);
    expect(seen.transformImageSrc('a.png', {})).toBeNull();
  });
});
