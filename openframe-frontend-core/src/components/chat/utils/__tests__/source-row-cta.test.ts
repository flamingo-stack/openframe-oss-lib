import { describe, expect, it, vi } from 'vitest';
import type { ComposeContentUrl } from '../../../../utils/content-href';
import { makeComposeContentUrl } from '../../../../utils/content-href';
import { resolveSourceRowCTA } from '../source-row-cta';

/**
 * Every row's address comes from ONE rule, the host's composer (`composeContentUrl`): a record by its
 * `externalUrl`, a document by its tree `path` (handed over as the `slug`). The lib builds no address of its own,
 * so a doc on the platform the chat runs on cannot open another deployment of it (CU-17tkuw61kfy: a doc card on
 * the openframe preview opened production hub.openframe.ai).
 */
describe('resolveSourceRowCTA: one address rule, the host composer', () => {
  const markdownRow = {
    documentType: 'markdown',
    id: 'd1',
    title: 'Install guide',
    path: 'getting-started/install',
  };
  const recordRow = {
    documentType: 'blog_post',
    id: '42',
    title: 'A post',
    externalUrl: 'https://www.flamingo.run/blog/a-post',
    targetPlatform: 'flamingo',
  };

  it('hands a doc to the composer with its path as the slug, and uses the address it returns', () => {
    const composeContentUrl = vi.fn<ComposeContentUrl>(() => ({
      href: '/knowledge-base/getting-started/install',
      targetPlatform: 'openframe',
    }));
    const md = resolveSourceRowCTA(markdownRow, { composeContentUrl });

    expect(composeContentUrl).toHaveBeenCalledWith({
      type: 'markdown',
      identifier: 'd1',
      slug: 'getting-started/install',
      externalUrl: null,
      targetPlatform: null,
    });
    expect(md.href).toBe('/knowledge-base/getting-started/install');
    expect(md.targetPlatform).toBe('openframe');
  });

  it('hands a record to the same composer with its externalUrl', () => {
    const composeContentUrl = vi.fn<ComposeContentUrl>(input => ({
      href: input.externalUrl ?? '',
      targetPlatform: input.targetPlatform ?? null,
    }));
    const post = resolveSourceRowCTA(recordRow, { composeContentUrl });

    expect(composeContentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'blog_post', identifier: '42', externalUrl: recordRow.externalUrl }),
    );
    expect(post.href).toBe(recordRow.externalUrl);
    expect(post.targetPlatform).toBe('flamingo');
  });

  it('an embedder that hosts a doc type links it in-app, by the same rule as its hosted content', () => {
    const composeContentUrl = makeComposeContentUrl({
      hostedTypes: new Set(['markdown']),
      contentOrigin: 'https://hub.example',
      suffixes: { markdown: 'help-center/knowledge-base' },
    });
    const md = resolveSourceRowCTA(markdownRow, { composeContentUrl });
    expect(md.href).toBe('/help-center/knowledge-base/getting-started/install');
  });

  it('a doc the composer has no viewer for has no link, and is still askable', () => {
    const md = resolveSourceRowCTA(markdownRow, { composeContentUrl: () => ({ href: '', targetPlatform: null }) });
    expect(md.href).toBeNull();
    expect(md.askable).toBe(true);
  });

  it('with no composer a doc has no link and a record keeps its own address', () => {
    expect(resolveSourceRowCTA(markdownRow, {}).href).toBeNull();
    expect(resolveSourceRowCTA(recordRow, {}).href).toBe(recordRow.externalUrl);
  });

  it('a doc path is sanitized before it reaches the composer', () => {
    const composeContentUrl = vi.fn<ComposeContentUrl>(() => ({ href: '/x', targetPlatform: null }));
    resolveSourceRowCTA({ ...markdownRow, path: 'a/b?c=<script>' }, { composeContentUrl });
    expect(composeContentUrl.mock.calls[0][0].slug).toBe('a/bcscript');
  });
});
