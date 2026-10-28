import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setEmbedAuthAdapter } from '../../../../utils/embed-authed-fetch';
import { RichMarkdownRenderer, SimpleMarkdownRenderer } from '../index';

/**
 * Edge cases of the click-to-load stand-in (`ExternalMediaGate`) on the chat surface. jsdom's page is
 * `http://localhost:3000`; `attacker.example` stands for any third-party host.
 */

/** The stand-ins on the page (or in `host`), by the action their button names (`Load image from attacker.example`). */
const standIns = (host?: HTMLElement) =>
  (host ? within(host) : screen)
    .queryAllByRole('button', { name: /^Load (image|video|diagram)( from |$)/ })
    .map(button => button.textContent);
/** Where the drawn images load from. */
const imgSrcs = (host?: HTMLElement) =>
  (host ? within(host) : screen).queryAllByRole('img').map(img => img.getAttribute('src'));

afterEach(() => {
  setEmbedAuthAdapter(null);
});

describe('stand-in placement: wherever markdown can put an image', () => {
  const PLACES: Record<string, string> = {
    'reference-style image': '![chart][r]\n\n[r]: https://attacker.example/r.png',
    'image with a title': '![chart](https://attacker.example/t.png "Quarterly")',
    'image in a table cell': '| a |\n| - |\n| ![chart](https://attacker.example/c.png) |',
    'image in a list item': '- ![chart](https://attacker.example/l.png)',
    'image in a blockquote': '> ![chart](https://attacker.example/q.png)',
    'image in a heading': '## ![chart](https://attacker.example/h.png)',
    'raw img with size attributes': '<img src="https://attacker.example/s.png" width="600" height="400" alt="chart">',
    'plain http': '![chart](http://attacker.example/p.png)',
    'upper-case host': '![chart](https://ATTACKER.EXAMPLE/U.PNG)',
    'protocol-relative': '![chart](//attacker.example/r.png)',
  };

  for (const [name, md] of Object.entries(PLACES)) {
    it(`draws one stand-in and no image: ${name}`, () => {
      render(<SimpleMarkdownRenderer content={md} />);
      expect(imgSrcs()).toEqual([]);
      expect(screen.getAllByRole('button', { name: 'Load image from attacker.example' })).toHaveLength(1);
    });
  }
});

describe('what never gets a stand-in', () => {
  it('drops data: and javascript: images outright (nothing to name, nothing to load)', () => {
    render(<SimpleMarkdownRenderer content={'![a](data:image/png;base64,AAAA)\n\n<img src="javascript:alert(1)">'} />);
    expect(imgSrcs()).toEqual([]);
    expect(standIns()).toEqual([]);
  });

  // hast-util-sanitize matches the scheme case-sensitively, so it drops the image before any origin check runs.
  it('drops an image whose scheme is upper-case: no image, no stand-in, no request', () => {
    const { container } = render(<SimpleMarkdownRenderer content={'![chart](HTTPS://attacker.example/U.PNG)'} />);
    expect(imgSrcs()).toEqual([]);
    expect(container.innerHTML).not.toContain('attacker.example');
  });

  it('draws relative images in every spelling without asking', () => {
    render(<SimpleMarkdownRenderer content={'![a](./a.png) ![b](../b.png) ![c](c.png) ![d](/d.png?x=1#f)'} />);
    expect(standIns()).toEqual([]);
    expect(imgSrcs()).toHaveLength(4);
  });

  it('keeps an app image and drops only the third-party srcset candidate', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'<img src="/ok.png" srcset="/ok.png 1x, https://attacker.example/x 2x">'} />,
    );
    expect(standIns()).toEqual([]);
    expect(imgSrcs()).toEqual(['/ok.png']);
    expect(container.innerHTML).not.toContain('attacker.example');
  });

  it('draws nothing for an image whose only source is a third-party srcset', () => {
    const { container } = render(<SimpleMarkdownRenderer content={'<img srcset="https://attacker.example/x 1x">'} />);
    expect(imgSrcs()).toEqual([]);
    expect(container.innerHTML).not.toContain('attacker.example');
  });
});

describe('the reader loads it', () => {
  // The pressed button unmounts with the stand-in; focus must land on what replaced it, not fall back to <body>.
  it('moves focus to the loaded image, so a keyboard reader keeps their place', () => {
    render(<SimpleMarkdownRenderer content={'![chart](https://attacker.example/focus.png)'} />);
    const button = screen.getByRole('button', { name: 'Load image from attacker.example' });
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole('group', { name: 'Image from attacker.example' })).toHaveFocus();
    expect(screen.getByRole('img', { name: 'chart' })).toBeTruthy();
  });

  it('does not take focus for media the reader had already loaded', () => {
    const md = '![chart](https://attacker.example/again.png)';
    const { unmount } = render(<SimpleMarkdownRenderer content={md} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load image from attacker.example' }));
    unmount();
    render(<SimpleMarkdownRenderer content={md} />);
    expect(screen.getByRole('group', { name: 'Image from attacker.example' })).not.toHaveFocus();
  });

  // A stand-in's button inside a link would be a control inside a control: the image becomes the link's text.
  it('turns a third-party image inside a link into the link’s text', () => {
    render(
      <SimpleMarkdownRenderer content={'[![chart](https://attacker.example/l.png)](https://example.com/report)'} />,
    );
    expect(screen.getByRole('link', { name: 'chart' })).toBeTruthy();
    expect(standIns()).toEqual([]);
    expect(imgSrcs()).toEqual([]);
  });

  it('keeps an app image inside a link', () => {
    render(<SimpleMarkdownRenderer content={'[![chart](/kb/c.png)](https://example.com/report)'} />);
    expect(imgSrcs()).toEqual(['/kb/c.png']);
  });

  it('turns a raw <a><img></a> the same way', () => {
    render(
      <SimpleMarkdownRenderer
        content={'<a href="https://example.com/r"><img src="https://attacker.example/n.png" alt="n"></a>'}
      />,
    );
    expect(screen.getByRole('link', { name: 'n' })).toBeTruthy();
    expect(standIns()).toEqual([]);
  });

  it('stops the click from reaching anything around the stand-in', () => {
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <SimpleMarkdownRenderer content={'![chart](https://attacker.example/p.png)'} />
      </div>,
    );
    expect(fireEvent.click(screen.getByRole('button', { name: 'Load image from attacker.example' }))).toBe(false);
    expect(outer).not.toHaveBeenCalled();
  });

  it('loads only the image the reader clicked, even when another one has the same URL', () => {
    render(
      <SimpleMarkdownRenderer
        content={'![one](https://attacker.example/same.png)\n\n![two](https://attacker.example/same.png)'}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Load image from attacker.example' })[0]);
    expect(imgSrcs()).toEqual(['https://attacker.example/same.png']);
    expect(standIns()).toHaveLength(1);
  });

  it('keeps a loaded image when the streamed reply is parsed again as a whole', () => {
    const md = 'Here:\n\n![chart](https://attacker.example/stream.png)\n\nmore';
    const { rerender } = render(<SimpleMarkdownRenderer content={md} streaming />);
    fireEvent.click(screen.getByRole('button', { name: 'Load image from attacker.example' }));
    rerender(<SimpleMarkdownRenderer content={`${md} text`} streaming />);
    rerender(<SimpleMarkdownRenderer content={`${md} text, done.`} />);
    expect(standIns()).toEqual([]);
    expect(imgSrcs()).toEqual(['https://attacker.example/stream.png']);
  });

  it('holds a third-party image while the reply is still streaming', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'Here:\n\n![chart](https://attacker.example/live.png'} streaming />,
    );
    expect(container.innerHTML).not.toMatch(/src="https:\/\/attacker\.example/);
  });
});

describe('the app’s origins can change after the first render', () => {
  it('draws a gateway image once the host sanctions the gateway', () => {
    render(<SimpleMarkdownRenderer content={'![kb](https://gateway.example/kb/1.png)'} />);
    expect(standIns()).toHaveLength(1);
    act(() => setEmbedAuthAdapter({ allowedOrigins: ['https://gateway.example'] }));
    expect(standIns()).toEqual([]);
    expect(imgSrcs()).toEqual(['https://gateway.example/kb/1.png']);
  });
});

/**
 * The native shells, end to end through the engine: the page is a pseudo-origin and the tenant gateway is the origin
 * OpenFrame's chat runtime registers in `allowedOrigins`. The test setup mocks `window.location` as a plain object.
 */
describe('inside a native shell', () => {
  const SHELLS = {
    Capacitor: 'capacitor://localhost/knowledge-base/details/?id=1',
    Tauri: 'tauri://localhost/tickets/',
  };
  for (const [shell, href] of Object.entries(SHELLS)) {
    it(`${shell}: draws the gateway's and the bundle's images, holds a third party's`, () => {
      // A mocked plain object (see the test setup), not a navigation.
      Object.assign(window.location, { href });
      setEmbedAuthAdapter({ allowedOrigins: ['https://acme.openframe.ai'] });
      try {
        render(
          <SimpleMarkdownRenderer
            content={
              '![kb](https://acme.openframe.ai/api/knowledge-base/images/1)\n\n![logo](/assets/logo.svg)\n\n' +
              '![ext](https://attacker.example/x.png)'
            }
          />,
        );
        expect(imgSrcs()).toEqual(['https://acme.openframe.ai/api/knowledge-base/images/1', '/assets/logo.svg']);
        expect(screen.getAllByRole('button', { name: 'Load image from attacker.example' })).toHaveLength(1);
      } finally {
        window.location.href = 'http://localhost:3000/';
      }
    });
  }
});

describe('server render and hydration', () => {
  const md = '![rel](/kb/1.png)\n\n![abs](http://localhost:3000/kb/2.png)\n\n![ext](https://attacker.example/3.png)';

  it('gives the server answer while hydrating, then the page’s, with no mismatch', () => {
    const serverHtml = renderToString(<SimpleMarkdownRenderer content={md} />);
    // On the server only the relative image is the app's: the absolute same-origin one waits like a third party.
    expect(serverHtml).toContain('src="/kb/1.png"');
    expect(serverHtml).not.toContain('src="http://localhost:3000/kb/2.png"');
    expect((serverHtml.match(/data-external-media/g) ?? []).length).toBe(2);

    const host = document.createElement('div');
    host.innerHTML = serverHtml;
    document.body.appendChild(host);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recoverable = vi.fn();
    act(() => {
      hydrateRoot(host, <SimpleMarkdownRenderer content={md} />, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/hydrat/i);
    errors.mockRestore();
    // After hydration the page knows its own origin: the absolute same-origin image is drawn.
    expect(imgSrcs(host)).toEqual(['/kb/1.png', 'http://localhost:3000/kb/2.png']);
    expect(standIns(host)).toHaveLength(1);
    host.remove();
  });
});

describe('mermaid diagrams that load images', () => {
  const diagram = (shape: string) => '```mermaid\nflowchart TD\n  ' + shape + '\n  A --> B\n```';
  const GATED: Record<string, string> = {
    'double-quoted url': 'A@{ img: "https://attacker.example/i.png", w: 60, h: 60 }',
    'single-quoted url': "A@{ img: 'https://attacker.example/i.png', w: 60, h: 60 }",
    'unquoted url': 'A@{ img: https://attacker.example/i.png, w: 60, h: 60 }',
    'quoted key': 'A@{ "img": "https://attacker.example/i.png", w: 60, h: 60 }',
    'second image is the third-party one': 'A@{ img: "/ok.png" }\n  C@{ img: "https://attacker.example/i.png" }',
    'protocol-relative': 'A@{ img: "//attacker.example/i.png" }',
  };
  for (const [name, shape] of Object.entries(GATED)) {
    it(`holds the diagram: ${name}`, () => {
      render(<SimpleMarkdownRenderer content={diagram(shape)} />);
      expect(screen.getByRole('button', { name: 'Load diagram from attacker.example' })).toBeTruthy();
    });
  }

  it('draws a diagram with no shape data, icons or CSS loads without asking', () => {
    render(<SimpleMarkdownRenderer content={diagram('A["img: label text"]')} />);
    expect(standIns()).toEqual([]);
  });

  // Shape data is YAML, so neither the key nor the URL can be read reliably from the text: any `@{` waits.
  it('holds any diagram with shape data, without naming a host it cannot read', () => {
    render(<SimpleMarkdownRenderer content={diagram('A@{ img: "/ok.png" }')} />);
    expect(screen.getByRole('button', { name: 'Load diagram' })).toBeTruthy();
    expect(screen.getByText(/Can load images from other sites/)).toBeTruthy();
  });

  // The bypasses an adversarial review found against a regex on the `img` key; each must still wait.
  const BYPASSES: Record<string, string> = {
    'escaped key': 'flowchart TD\n  A@{ "\\x69mg": "https://attacker.example/x.png", label: "x" }',
    'escaped URL': 'flowchart TD\n  A@{ img: "https\\u003a//attacker.example/x.png", label: "x" }',
    'YAML tag': 'flowchart TD\n  A@{ img: !!str https://attacker.example/x.png, label: "x" }',
    'YAML alias': 'flowchart TD\n  A@{ label: &u "https://attacker.example/x.png", img: *u }',
    'kanban item': 'kanban\n  todo[Todo]\n    t1[Task]@{ img: "https://attacker.example/k.png" }',
    'sequence properties icon':
      'sequenceDiagram\n  participant Alice\n  properties Alice: {"icon": "https://attacker.example/seq.png"}\n  Alice->>Alice: hi',
    'sequence details from the page':
      'sequenceDiagram\n  participant Alice\n  details Alice: evil\n  Alice->>Alice: hi',
    'style url': 'flowchart TD\n  A --> B\n  style A fill:url(https://attacker.example/p.svg#p)',
    'classDef escaped url': 'flowchart TD\n  A --> B\n  classDef x fill:u\\72 l(https://attacker.example/p.svg#p)',
  };
  for (const [name, source] of Object.entries(BYPASSES)) {
    it(`holds the diagram: ${name}`, () => {
      render(<SimpleMarkdownRenderer content={'```mermaid\n' + source + '\n```'} />);
      expect(screen.getAllByRole('button', { name: /^Load diagram/ })).toHaveLength(1);
      expect(screen.queryByRole('group', { name: 'Diagram zoom' })).toBeNull();
    });
  }

  it('leaves authored content (Rich) its diagrams', () => {
    render(<RichMarkdownRenderer content={diagram('A@{ img: "https://cdn.example.com/i.png" }')} />);
    expect(standIns()).toEqual([]);
  });
});
