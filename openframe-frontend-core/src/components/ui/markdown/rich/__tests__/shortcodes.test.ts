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
 * Steps 3.5-5 restore the code-block / markdown-link / table-row placeholders.
 * They used to restore with a plain string replacement, which re-interprets
 * `$&`, `` $` ``, `$'` and `$$` IN THE REPLACEMENT — so a fenced shell snippet
 * containing `$$` or `$'…'` was silently rewritten.
 */
describe('processShortcodes placeholder restore', () => {
  it('restores a fenced block containing `$$` verbatim', () => {
    const output = processShortcodes('```bash\ntmp=/tmp/x.$$\n```\n\nTrailing prose.');
    expect(output).toContain('tmp=/tmp/x.$$');
  });

  it("does not splice the rest of the document into a fence containing `$'`", () => {
    const output = processShortcodes("```bash\nsep=$'\\n'\n```\n\nTrailing prose.");
    expect(output).toContain("sep=$'\\n'");
    // `$'` used to expand to everything AFTER the placeholder, duplicating it.
    expect(output.match(/Trailing prose\./g)).toHaveLength(1);
  });

  it('restores inline code containing `$&` verbatim', () => {
    const output = processShortcodes('Use `perl -pe "s/x/[$&]/"` for that.');
    expect(output).toContain('s/x/[$&]/');
  });
});

/**
 * Every `embed-overrides.tsx` div branch requires its `data-*` payload; a
 * blank one renders as an empty div (previously: a permanently broken
 * player). A whitespace-only shortcode payload must therefore stay literal
 * text rather than expanding into a payload-less embed div.
 */
describe('processShortcodes blank shortcode payloads', () => {
  it.each([
    ['{{youtube:   }}', 'youtube-embed'],
    ['{{figma:   }}', 'figma-embed'],
    ['{{linkedin:   }}', 'linkedin-embed'],
    ['{{link:   }}', 'link-preview'],
    ['{{reddit:   }}', 'reddit-embed'],
    ['{{tweet:   }}', 'tweet-embed'],
  ])('leaves %s as literal text instead of emitting a payload-less %s', (input, className) => {
    const output = processShortcodes(input);
    expect(output).not.toContain(className);
    expect(output).toContain(input);
  });

  it('still expands a well-formed shortcode', () => {
    expect(processShortcodes('{{youtube: dQw4w9WgXcQ }}')).toContain(
      '<div class="youtube-embed" data-video-id="dQw4w9WgXcQ"></div>',
    );
  });
});
