import { describe, expect, it } from 'vitest'
import { buildDiscussPrompt } from '../discuss-ref-prompt'
import { readFetchedCardTitle } from '../resolve-fetched-card-href'

const ROADMAP_REF = {
  type: 'roadmap_item',
  id: '86ad3qvv5',
  title: 'Deep Google Workspace tenant management',
}

describe('buildDiscussPrompt', () => {
  it('guide/SSE shape — prose only, retrieval rides entityIdFilter', () => {
    expect(buildDiscussPrompt(ROADMAP_REF)).toBe(
      'Tell me more about Deep Google Workspace tenant management',
    )
  })

  it('Mingo shape — appends the reference the agent has no filter for', () => {
    expect(buildDiscussPrompt(ROADMAP_REF, { includeReference: true })).toBe(
      'Tell me more about Deep Google Workspace tenant management (roadmap_item 86ad3qvv5)',
    )
  })

  it('a synthetic ref (title === id) never leaks the id as the subject', () => {
    const synthetic = { type: 'roadmap_item', id: '86ad3qvv5', title: '86ad3qvv5' }
    expect(buildDiscussPrompt(synthetic, { includeReference: true })).toBe(
      'Tell me more about this item (roadmap_item 86ad3qvv5)',
    )
  })

  it('missing / blank title falls back to "this item"', () => {
    expect(buildDiscussPrompt({ type: 'blog_post', id: 'b1' })).toBe('Tell me more about this item')
    expect(buildDiscussPrompt({ type: 'blog_post', id: 'b1', title: '   ' })).toBe(
      'Tell me more about this item',
    )
  })

  it('no id → no reference suffix', () => {
    expect(buildDiscussPrompt({ type: 'blog_post', id: '', title: 'Hello' }, { includeReference: true })).toBe(
      'Tell me more about Hello',
    )
  })
})

describe('readFetchedCardTitle — what upgrades a synthetic ref before the prompt', () => {
  it('prefers title, then name', () => {
    expect(readFetchedCardTitle({ title: 'Roadmap row' })).toBe('Roadmap row')
    expect(readFetchedCardTitle({ name: 'Named row' })).toBe('Named row')
    expect(readFetchedCardTitle({ title: '  ', name: 'Named row' })).toBe('Named row')
  })

  it('null for rows with neither (and for non-objects)', () => {
    expect(readFetchedCardTitle({ headline: 'nope' })).toBeNull()
    expect(readFetchedCardTitle(null)).toBeNull()
    expect(readFetchedCardTitle('string')).toBeNull()
    expect(readFetchedCardTitle({ title: 42 })).toBeNull()
  })

  it('end to end: fetched row title reaches the prompt', () => {
    const synthetic = { type: 'roadmap_item', id: '86ad3qvv5', title: '86ad3qvv5' }
    const row = { id: 'db-9', title: 'Deep Google Workspace tenant management' }
    const enriched = { ...synthetic, title: readFetchedCardTitle(row) ?? synthetic.title }
    expect(buildDiscussPrompt(enriched, { includeReference: true })).toBe(
      'Tell me more about Deep Google Workspace tenant management (roadmap_item 86ad3qvv5)',
    )
  })
})
