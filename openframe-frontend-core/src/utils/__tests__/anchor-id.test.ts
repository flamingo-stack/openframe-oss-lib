// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { extractSections } from '../markdown-section-extractor'
import { findAnchorElementByNormalizedId, normalizeAnchorId } from '../anchor-id'
import { getHashTargetElement } from '../same-page-hash-nav'

describe('normalizeAnchorId', () => {
  it('drops the hyphen GitHub leaves behind a stripped emoji', () => {
    expect(normalizeAnchorId('-getting-started')).toBe('getting-started')
    expect(normalizeAnchorId('-architecture-diagrams')).toBe('architecture-diagrams')
  })

  it('collapses the hyphen run GitHub emits around a dropped "&"', () => {
    expect(normalizeAnchorId('-community--support')).toBe('community-support')
  })

  it('is a no-op for an already-clean id', () => {
    expect(normalizeAnchorId('table-of-contents')).toBe('table-of-contents')
  })

  it('normalizes raw heading text too', () => {
    expect(normalizeAnchorId('🚀 Getting Started')).toBe('getting-started')
  })
})

describe('findAnchorElementByNormalizedId', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1 id="openframe-cli-documentation">OpenFrame CLI — Documentation</h1>
      <h2 id="table-of-contents">📚 Table of Contents</h2>
      <h2 id="getting-started">🚀 Getting Started</h2>
      <h2 id="community-support">💬 Community &amp; Support</h2>
      <h3 id="a---b">A - B</h3>
    `
  })

  it('resolves a GitHub-style anchor onto our heading id', () => {
    expect(findAnchorElementByNormalizedId('-getting-started', document)?.id).toBe('getting-started')
    expect(findAnchorElementByNormalizedId('-table-of-contents', document)?.id).toBe(
      'table-of-contents',
    )
  })

  it('resolves the double-hyphen "&" form', () => {
    expect(findAnchorElementByNormalizedId('-community--support', document)?.id).toBe(
      'community-support',
    )
  })

  it('matches an id whose own raw form normalizes differently', () => {
    // `a---b` is not reachable by normalized lookup — only the heading scan finds it.
    expect(findAnchorElementByNormalizedId('a-b', document)?.id).toBe('a---b')
  })

  it('returns null for an anchor with no heading behind it', () => {
    expect(findAnchorElementByNormalizedId('nope', document)).toBeNull()
    expect(findAnchorElementByNormalizedId('', document)).toBeNull()
  })
})

describe('getHashTargetElement — the fuzzy pass is wired into THE resolver', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h2 id="getting-started">🚀 Getting Started</h2>
      <div id="ticket-a/b">encoded-id row</div>
    `
  })

  it('exact ids still win, unchanged', () => {
    expect(getHashTargetElement('getting-started')?.id).toBe('getting-started')
  })

  it('percent-decoding still runs before the fuzzy pass', () => {
    expect(getHashTargetElement('ticket-a%2Fb')?.id).toBe('ticket-a/b')
  })

  it('falls back to a normalized match — the TOC bug, through the public entry point', () => {
    expect(getHashTargetElement('-getting-started')?.id).toBe('getting-started')
  })

  it('still returns null when nothing matches', () => {
    expect(getHashTargetElement('nope')).toBeNull()
    expect(getHashTargetElement('')).toBeNull()
  })
})

describe('the openframe-cli doc that reported the bug', () => {
  // Verbatim shapes from
  // GET /api/docs/sources/openframe-docs/content?path=openframe-cli
  const headings = [
    '# OpenFrame CLI — Documentation',
    '## 📚 Table of Contents',
    '## 🚀 Getting Started',
    '## 🛠️ Development',
    '## 💬 Community & Support',
  ].join('\n\n')
  const tocHrefs = ['#-getting-started', '#-development', '#-community--support']

  it('every TOC href resolves to the id the section extractor emits', () => {
    const sections = extractSections(headings)
    document.body.innerHTML = sections
      .map((s) => `<h2 id="${s.id}">${s.title}</h2>`)
      .join('')

    const resolved = tocHrefs.map((href) => getHashTargetElement(href.slice(1))?.id ?? null)
    expect(resolved).toEqual(['getting-started', 'development', 'community-support'])
    // …and none of them resolved before this helper existed:
    expect(tocHrefs.map((href) => document.getElementById(href.slice(1)))).toEqual([
      null,
      null,
      null,
    ])
  })
})
