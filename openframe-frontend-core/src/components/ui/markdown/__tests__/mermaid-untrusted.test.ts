import { describe, expect, it } from 'vitest';
import { __scrubMermaidSvgForTest as scrub, __withoutMermaidConfigForTest as withoutConfig } from '../mermaid-diagram';

/**
 * Untrusted diagrams render without their config and with their SVG scrubbed (the second line behind the click gate
 * in `MermaidDiagram`). String-level checks of both.
 */
describe('withoutMermaidConfig', () => {
  it('drops %%{init}%% directives anywhere, including the fontFamily CSS injection', () => {
    const chart =
      '%%{init: {"fontFamily": "x;position:fixed;inset:0;background-image:url(https://attacker.example/ff.png)"}}%%\n' +
      'graph TD\n  A-->B\n%%{ wrap }%%';
    expect(withoutConfig(chart)).toBe('\ngraph TD\n  A-->B\n');
  });

  it('drops front matter config at the top, and nothing else', () => {
    const chart =
      '---\nconfig:\n  fontFamily: "x;background-image:url(https://attacker.example/f.png)"\n---\ngraph TD\n  A-->B';
    expect(withoutConfig(chart)).toBe('graph TD\n  A-->B');
    expect(withoutConfig('graph TD\n  A["---"]-->B')).toBe('graph TD\n  A["---"]-->B');
  });

  it('drops an unterminated directive to the end', () => {
    expect(withoutConfig('graph TD\n  A-->B\n%%{init: {"themeCSS": "x"')).toBe('graph TD\n  A-->B\n');
  });
});

describe('scrubMermaidSvg', () => {
  const svg = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${inner}</svg>`;

  it('drops <image> elements and references to other documents', () => {
    const out = scrub(
      svg(
        '<image xlink:href="https://attacker.example/i.png"/><use href="https://attacker.example/s.svg#a"/>' +
          '<use href="#local"/><a href="https://example.com/doc"><text>link</text></a>',
      ),
    );
    expect(out).not.toContain('attacker.example');
    expect(out).not.toContain('<image');
    expect(out).toContain('href="#local"');
    expect(out).toContain('href="https://example.com/doc"');
  });

  it('drops CSS that loads a resource from <style>, style attributes and paint attributes', () => {
    const out = scrub(
      svg(
        '<style>@import url(https://attacker.example/x.css); #d .n{fill:#fff;background-image:url(https://attacker.example/b.png)} #d .m{fill:url(#g)}</style>' +
          '<rect style="fill:red;background:u\\72 l(https://attacker.example/s.png)" fill="url(https://attacker.example/p.svg#p)"/>' +
          '<rect fill="url(#g)"/>',
      ),
    );
    expect(out).not.toContain('attacker.example');
    expect(out).toContain('fill:#fff');
    expect(out).toContain('fill:url(#g)');
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain('fill:red');
  });

  it('draws nothing for an SVG that does not parse', () => {
    expect(scrub('<svg><g></svg>')).toBe('');
  });
});
