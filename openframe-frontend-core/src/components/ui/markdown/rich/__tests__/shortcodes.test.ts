import { describe, it, expect } from 'vitest';
import { processShortcodes } from '../shortcodes';

/**
 * Step 1.5 of processShortcodes: pasted social embed markup ships a
 * `widgets.js` loader `<script>` alongside its blockquote. Scripts never
 * execute on this surface, but before the strip they leaked into the
 * article body as VISIBLE escaped source text (2026-08 Reddit embed
 * incident). These tests pin the strip's contract.
 */
describe('processShortcodes script stripping', () => {
  it('strips the Reddit widgets.js loader that accompanies pasted blockquote embeds', () => {
    const input =
      '<blockquote class="reddit-embed-bq" data-embed-height="316">' +
      '<a href="https://www.reddit.com/r/sysadmin/comments/1op05cl/anyone_using_splashtop_as_their_main_remote/">Anyone using Splashtop?</a>' +
      '</blockquote>' +
      '<script async="" src="https://embed.reddit.com/widgets.js" charset="UTF-8"></script>';
    const output = processShortcodes(input);
    expect(output).not.toContain('<script');
    expect(output).not.toContain('widgets.js');
    expect(output).toContain('reddit-embed-bq');
    expect(output).toContain('/comments/1op05cl/');
  });

  it('strips the Twitter widgets.js loader', () => {
    const input =
      '<blockquote class="twitter-tweet"><a href="https://twitter.com/user/status/123">tweet</a></blockquote>' +
      '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>';
    const output = processShortcodes(input);
    expect(output).not.toContain('<script');
    expect(output).toContain('twitter-tweet');
  });

  it('strips inline script elements with body content', () => {
    const output = processShortcodes('before <script>alert("x")</script> after');
    expect(output).not.toContain('script');
    expect(output).toContain('before');
    expect(output).toContain('after');
  });

  it('preserves script tags inside fenced code blocks', () => {
    const input = 'Example:\n\n```html\n<script src="https://example.com/app.js"></script>\n```\n';
    const output = processShortcodes(input);
    expect(output).toContain('<script src="https://example.com/app.js"></script>');
  });

  it('preserves script tags inside inline code', () => {
    const input = 'Use `<script defer></script>` for deferred loading.';
    const output = processShortcodes(input);
    expect(output).toContain('`<script defer></script>`');
  });

  it('leaves an unclosed script opener alone (falls through to the escape pre-pass)', () => {
    const input = 'An unclosed <script> opener in prose.';
    const output = processShortcodes(input);
    expect(output).toContain('<script>');
  });
});

/**
 * Design-doc embeds (R11): the spec's `{{figma:FILE_KEY[:NODE_ID]}}` grammar is
 * rewritten onto the canonical `{{figma:URL}}` rule, and Claude artifacts get
 * the SAME treatment — a shortcode → a block the renderer maps to `ClaudeEmbed`.
 * Both are markdown blocks, so they render identically in a spec body, a
 * comment, or a links rail, and no surface hand-assembles its own card.
 */
describe('processShortcodes design-doc embeds', () => {
  it('rewrites {{figma:KEY:NODE}} to the canonical design URL and renders the figma embed', () => {
    const output = processShortcodes('{{figma:aB3xK9:12-405}}');
    expect(output).toContain('class="figma-embed"');
    expect(output).toContain('data-figma-url="https://www.figma.com/design/aB3xK9?node-id=12-405"');
  });

  it('accepts a colon-separated node id and a bare key', () => {
    expect(processShortcodes('{{figma:aB3xK9:12:405}}')).toContain('node-id=12-405');
    expect(processShortcodes('{{figma:aB3xK9}}')).toContain('data-figma-url="https://www.figma.com/design/aB3xK9"');
  });

  it('leaves the existing {{figma:URL}} grammar untouched', () => {
    const output = processShortcodes('{{figma:https://www.figma.com/proto/aB3xK9/Flows?node-id=1-2}}');
    expect(output).toContain('data-figma-url="https://www.figma.com/proto/aB3xK9/Flows?node-id=1-2"');
  });

  it('renders a Claude artifact / Claude Design link as an embed block, like figma', () => {
    const artifact = processShortcodes('{{claude-artifact:https://claude.ai/public/artifacts/abc-123}}');
    expect(artifact).toContain('class="claude-embed"');
    expect(artifact).toContain('data-url="https://claude.ai/public/artifacts/abc-123"');
    expect(artifact).toContain('data-kind="artifact"');

    const design = processShortcodes('{{claude-design:https://claude.ai/design/xyz}}');
    expect(design).toContain('data-kind="design"');
  });

  it('threads the optional title and mirror segments into data attributes', () => {
    const titled = processShortcodes('{{claude-artifact:https://claude.ai/a|Brief doc}}');
    expect(titled).toContain('data-title="Brief doc"');
    expect(titled).not.toContain('data-embed-src');

    const mirrored = processShortcodes(
      '{{claude-artifact:https://claude.ai/a|Brief doc|/api/storage/view/design-briefs/x.html}}',
    );
    expect(mirrored).toContain('data-title="Brief doc"');
    expect(mirrored).toContain('data-embed-src="/api/storage/view/design-briefs/x.html"');

    // Untitled mirror: the empty title slot is skipped, the mirror still rides.
    const untitled = processShortcodes(
      '{{claude-artifact:https://claude.ai/a||/api/storage/view/design-briefs/x.html}}',
    );
    expect(untitled).not.toContain('data-title');
    expect(untitled).toContain('data-embed-src="/api/storage/view/design-briefs/x.html"');
  });

  it('recognizes the mirror segment by path SHAPE, never by pipe position', () => {
    // A pre-existing title containing `|` stays a title — nothing is framed.
    const pipeTitle = processShortcodes('{{claude-artifact:https://claude.ai/a|Design | v2}}');
    expect(pipeTitle).toContain('data-title="Design | v2"');
    expect(pipeTitle).not.toContain('data-embed-src');

    // Pipe title AND a mirror: the path-shaped tail is the mirror, the rest is the title.
    const both = processShortcodes(
      '{{claude-artifact:https://claude.ai/a|Design | v2|/api/storage/view/design-briefs/x.html}}',
    );
    expect(both).toContain('data-title="Design | v2"');
    expect(both).toContain('data-embed-src="/api/storage/view/design-briefs/x.html"');

    // Non-path tails (absolute urls, protocol-relative, schemes) are NEVER a
    // frame source — they fold into the title as plain text.
    const evil = processShortcodes('{{claude-artifact:https://claude.ai/a|T|https://evil.example}}');
    expect(evil).not.toContain('data-embed-src');
    const protoRelative = processShortcodes('{{claude-artifact:https://claude.ai/a|T|//evil.example}}');
    expect(protoRelative).not.toContain('data-embed-src');
    const scheme = processShortcodes('{{claude-artifact:https://claude.ai/a|T|javascript:alert(1)}}');
    expect(scheme).not.toContain('data-embed-src');
    // The WHATWG backslash trap: `/\host` parses as an AUTHORITY (like
    // `//host`), so it must be rejected exactly like protocol-relative.
    const backslash = processShortcodes(
      '{{claude-artifact:https://claude.ai/a|T|/\\evil.example/x.html}}',
    );
    expect(backslash).not.toContain('data-embed-src');
    // A TITLE that merely starts with `/` (contains whitespace) stays a
    // title — it is prose, not a path.
    const slashTitle = processShortcodes('{{claude-artifact:https://claude.ai/a|/api redesign}}');
    expect(slashTitle).toContain('data-title="/api redesign"');
    expect(slashTitle).not.toContain('data-embed-src');

    // A TWO-segment form is always `URL|TITLE` — a mirror needs its own
    // (third) slot, so even a whitespace-free path-shaped title survives.
    const pathTitle = processShortcodes('{{claude-artifact:https://claude.ai/a|/roadmap}}');
    expect(pathTitle).toContain('data-title="/roadmap"');
    expect(pathTitle).not.toContain('data-embed-src');
  });

  it('escapes the url attribute so a crafted link cannot break out of the block', () => {
    const output = processShortcodes('{{claude-artifact:https://claude.ai/a"><script>alert(1)</script>}}');
    expect(output).not.toContain('<script>');
    expect(output).toContain('&quot;');
  });



});
