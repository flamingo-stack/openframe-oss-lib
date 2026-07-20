/**
 * Mermaid renders MODEL-authored diagram source on the chat path, and the
 * result is injected with `dangerouslySetInnerHTML`. This fixture pins the
 * hardening in ../mermaid-diagram.tsx: a hostile node label must NOT survive
 * as live HTML.
 *
 * The test drives `mermaid` with the SAME security knobs the component sets
 * (`securityLevel: 'strict'`, root `htmlLabels: false`) so a regression in
 * either one fails here.
 */
import { beforeAll, describe, expect, it } from 'vitest'

// jsdom implements no SVG layout, and mermaid's dagre pass measures text.
// These stubs are only about making the renderer RUN; they do not touch the
// sanitization path under test.
function installSvgLayoutStubs(): void {
  const proto = (globalThis as unknown as { SVGElement?: { prototype: Record<string, unknown> } }).SVGElement?.prototype
  if (!proto) return
  proto.getBBox = function getBBox() {
    return { x: 0, y: 0, width: 100, height: 20 }
  }
  proto.getComputedTextLength = function getComputedTextLength() {
    return 100
  }
  proto.getScreenCTM = function getScreenCTM() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }
  }
}

// Second tuple slot: text that MUST be present in the rendered output — a
// positive control proving the diagram was actually drawn, so the negative
// assertions below can't pass on empty output. Note the two payloads are
// neutralized differently: the `<img>` survives as ESCAPED label text, while
// the `<script>` is dropped outright, so its control is the sibling node.
const HOSTILE_LABELS: ReadonlyArray<readonly [chart: string, expectedText: string]> = [
  ['graph TD\n  A["<img src=x onerror=alert(1)>"] --> B["ok"]', '<img'],
  ['graph TD\n  A["<script>alert(1)</script>"] --> B["ok"]', 'ok'],
]

describe('mermaid hostile-label hardening', () => {
  beforeAll(() => {
    installSvgLayoutStubs()
  })

  it.each(HOSTILE_LABELS)('does not emit live HTML for %j', async (chart, expectedText) => {
    const { default: mermaid } = await import('mermaid')

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      flowchart: { useMaxWidth: true },
      htmlLabels: false,
      securityLevel: 'strict',
    })

    const { svg } = await mermaid.render(`mermaid-security-${Math.random().toString(36).slice(2)}`, chart)

    // No live element, and no event-handler attribute, anywhere in the output.
    expect(svg).not.toMatch(/<img[\s>]/i)
    expect(svg).not.toMatch(/<script[\s>]/i)
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i)
    // `htmlLabels: false` means no HTML subtree is minted for labels at all.
    expect(svg).not.toMatch(/<foreignObject/i)

    // And it stays inert once parsed as HTML: the hostile markup must appear
    // as TEXT (escaped), never as an element node.
    const host = document.createElement('div')
    host.innerHTML = svg
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('script')).toBeNull()
    const text = host.textContent ?? ''
    expect(text).toContain(expectedText)
    // The script payload never survives in any form.
    expect(text).not.toContain('alert(1)')
  })
})
