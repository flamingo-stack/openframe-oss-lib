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
 * Design-doc embeds (R11): the spec's `{{figma:FILE_KEY[:NODE_ID]}}` grammar
 * is rewritten onto the canonical `{{figma:URL}}` rule. (Claude artifact /
 * Claude Design links are NOT shortcodes: they are structured design-doc links
 * rendered by `ClaudeArtifactCard`, because claude.ai serves
 * `frame-ancestors 'self'` (it cannot be framed — verified 2026-08-23).
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



});
