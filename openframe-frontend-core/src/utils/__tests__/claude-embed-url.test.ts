import { describe, it, expect } from 'vitest';
import { toClaudeEmbedUrl } from '../embed-url-converters';

/**
 * The Claude counterpart of `toFigmaEmbedUrl`, and the newest url-trust
 * boundary in the markdown pipeline: whatever it returns is put in an iframe
 * `src`, so "not a published claude.ai artifact" must be `null`, always.
 */
describe('toClaudeEmbedUrl', () => {
  it('normalises every shape of a PUBLISHED artifact url to its embed route', () => {
    const embed = 'https://claude.ai/public/artifacts/abc-123/embed';
    expect(toClaudeEmbedUrl('https://claude.ai/public/artifacts/abc-123')).toBe(embed);
    expect(toClaudeEmbedUrl('https://claude.ai/public/artifacts/abc-123/')).toBe(embed);
    // The url Anthropic's own "Get embed code" hands the author — the likeliest
    // paste of all, and it must not be treated as un-embeddable.
    expect(toClaudeEmbedUrl('https://claude.ai/public/artifacts/abc-123/embed')).toBe(embed);
    expect(toClaudeEmbedUrl('https://claude.ai/public/artifacts/abc-123/embed/')).toBe(embed);
    // claude.site short links (and their embed form) 308 to the same artifact.
    expect(toClaudeEmbedUrl('https://claude.site/artifacts/abc-123')).toBe(embed);
    expect(toClaudeEmbedUrl('https://claude.site/artifacts/abc-123/embed')).toBe(embed);
    expect(toClaudeEmbedUrl('https://CLAUDE.AI/public/artifacts/abc-123')).toBe(embed);
    // Query and fragment are the artifact's, not ours: the embed route is built
    // from the id alone.
    expect(toClaudeEmbedUrl('https://claude.ai/public/artifacts/abc-123?x=1#y')).toBe(embed);
  });

  it('refuses everything that is not a published artifact, and never throws', () => {
    // A Claude CODE artifact has no embeddable route at all.
    expect(toClaudeEmbedUrl('https://claude.ai/code/artifact/abc-123')).toBeNull();
    expect(toClaudeEmbedUrl('https://claude.ai/design/abc-123')).toBeNull();
    // Host must BE claude.ai/claude.site — not a prefix, a subdomain or userinfo.
    expect(toClaudeEmbedUrl('https://claude.ai.evil.com/public/artifacts/abc')).toBeNull();
    expect(toClaudeEmbedUrl('https://evil.com/public/artifacts/abc')).toBeNull();
    expect(toClaudeEmbedUrl('https://evil.com/?u=https://claude.ai/public/artifacts/abc')).toBeNull();
    expect(toClaudeEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(toClaudeEmbedUrl('//claude.ai/public/artifacts/abc')).toBeNull();
    expect(toClaudeEmbedUrl('not a url')).toBeNull();
    expect(toClaudeEmbedUrl('')).toBeNull();
    expect(toClaudeEmbedUrl(null)).toBeNull();
    expect(toClaudeEmbedUrl(undefined)).toBeNull();
  });
});
