import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { ClaudeEmbed } from '../claude-embed'
import { FigmaEmbed } from '../figma-embed'

/**
 * A Claude artifact must sit in the SAME chrome as every other embed viewer,
 * and — unlike the first-party vendors — must stay SANDBOXED, because an
 * artifact is HTML and JS written by a user of ours.
 */
const PUBLISHED = 'https://claude.ai/public/artifacts/abc-123'
const CODE_ARTIFACT = 'https://claude.ai/code/artifact/abc-123'

describe('ClaudeEmbed', () => {
  it('renders the shared frame, with the same wrapper and title element figma uses', () => {
    const claude = render(<ClaudeEmbed url={PUBLISHED} height="70vh" />).container
    const figma = render(<FigmaEmbed url="https://www.figma.com/design/K1/x" height="70vh" />).container
    expect(claude.firstElementChild?.className).toBe(figma.firstElementChild?.className)
    // Same heading treatment (`titleVariant="h6"`), not an h2.
    expect(claude.querySelector('span.text-h6')).not.toBeNull()
    expect(claude.querySelector('h2')).toBeNull()
  })

  it('SANDBOXES the artifact, and never grants it top-navigation', () => {
    const { container } = render(<ClaudeEmbed url={PUBLISHED} height="70vh" />)
    const iframe = container.querySelector('iframe')!
    const sandbox = iframe.getAttribute('sandbox') ?? ''
    // `allow-same-origin` + `allow-scripts` is what Anthropic's own embed
    // snippet uses; on a cross-origin frame it grants claude.ai's origin,
    // never ours.
    expect(sandbox.split(' ').sort()).toEqual(
      ['allow-forms', 'allow-popups', 'allow-same-origin', 'allow-scripts'],
    )
    // The point of sandboxing at all: an artifact cannot navigate the page
    // that embeds it.
    expect(sandbox).not.toContain('allow-top-navigation')
    expect(iframe.getAttribute('loading')).toBe('lazy')
    expect(iframe.getAttribute('allow')).toContain('clipboard')
  })

  it('frames the /embed route, never the artifact page itself', () => {
    const { container } = render(<ClaudeEmbed url={PUBLISHED} />)
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe(
      'https://claude.ai/public/artifacts/abc-123/embed',
    )
  })

  it('a NON-embeddable artifact keeps the action and shows the shared empty state', () => {
    const { container, getByText } = render(<ClaudeEmbed url={CODE_ARTIFACT} />)
    expect(container.querySelector('iframe')).toBeNull()
    getByText(/Open this one in Claude/)
    // The way out is always present.
    expect(container.textContent).toContain('Open in Claude')
  })

  it('occupies the SAME height as a figma embed, framed or not', () => {
    // Two embeds in one doc must read as two equal blocks — including when one
    // of them has no embeddable view and falls back to the empty state.
    const figmaBox = render(<FigmaEmbed url="https://www.figma.com/design/K1/x" height="70vh" />)
      .container.querySelector('[style*="70vh"]')
    const framed = render(<ClaudeEmbed url={PUBLISHED} height="70vh" />)
      .container.querySelector('[style*="70vh"]')
    const empty = render(<ClaudeEmbed url={CODE_ARTIFACT} height="70vh" />)
      .container.querySelector('[style*="70vh"]')
    for (const box of [figmaBox, framed, empty]) {
      expect(box).not.toBeNull()
      expect((box as HTMLElement).style.height).toBe('70vh')
    }
    // …and the empty box carries the same rounded border the iframe box does.
    expect((empty as HTMLElement).className).toContain('rounded-lg')
    expect((empty as HTMLElement).className).toContain('border-ods-border')
  })

  it('uses the author\'s name when there is one, and the kind otherwise', () => {
    expect(render(<ClaudeEmbed url={PUBLISHED} title="Suppression brief" />).container.textContent)
      .toContain('Suppression brief')
    expect(render(<ClaudeEmbed url={PUBLISHED} />).container.textContent).toContain('Claude Artifact')
    expect(render(<ClaudeEmbed url={PUBLISHED} kind="design" />).container.textContent).toContain('Claude Design')
  })
})
