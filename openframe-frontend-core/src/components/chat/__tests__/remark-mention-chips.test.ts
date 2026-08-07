import { describe, it, expect } from 'vitest'
import type { Root, Text, Link, Paragraph } from 'mdast'
import { remarkMentionChips } from '../remark-mention-chips'

/** One-paragraph tree holding a single text leaf — what the plugin walks. */
function treeOf(text: string): Root {
  return { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }] }
}

/**
 * unified's `Plugin` type declares a `this: Processor` parameter, so calling the
 * attacher bare (outside a pipeline) is a TS2684 — cast the attacher itself, not
 * just its return value, to drop that `this`.
 */
const attach = remarkMentionChips as unknown as () => (t: Root) => void

function run(text: string): Array<Text | Link> {
  const tree = treeOf(text)
  attach()(tree)
  return (tree.children[0] as Paragraph).children as Array<Text | Link>
}

/** `mention://marker:id` urls the plugin emitted, in order. */
function mentions(text: string): string[] {
  return run(text).flatMap((n) => (n.type === 'link' ? [n.url] : []))
}

describe('remarkMentionChips markers', () => {
  it('parses the lowercase markers', () => {
    expect(mentions('see @device:64f0a1 and @kb:5')).toEqual([
      'mention://device:64f0a1',
      'mention://kb:5',
    ])
  })

  it('parses a camelCase marker', () => {
    // Regression: `ContextItemType.SCHEDULED_SCRIPT` ships as `scheduledScript`,
    // and a lowercase-only grammar matched NOTHING in the token — the mention
    // silently stayed raw text in the bubble instead of becoming a chip.
    expect(mentions('run @scheduledScript:6a6c9342f8e10b2477900c08 now')).toEqual([
      'mention://scheduledScript:6a6c9342f8e10b2477900c08',
    ])
  })

  it('keeps the surrounding text intact around a camelCase mention', () => {
    const parts = run('run @scheduledScript:6a6c9342f8e10b2477900c08 now')
    expect(parts.map((n) => (n.type === 'text' ? n.value : `[${(n as Link).url}]`))).toEqual([
      'run ',
      '[mention://scheduledScript:6a6c9342f8e10b2477900c08]',
      ' now',
    ])
  })

  it('fires inside punctuation but never mid-word', () => {
    expect(mentions('(@scheduledScript:6a6c9342f8e10b2477900c08)')).toEqual([
      'mention://scheduledScript:6a6c9342f8e10b2477900c08',
    ])
    // An email-shaped host:port is not a mention — the `@` is preceded by a word char.
    expect(mentions('mail user@Host:1234 stays text')).toEqual([])
  })

  it('leaves a trailing sentence period out of the id', () => {
    expect(mentions('ran @scheduledScript:6a6c9342f8e10b2477900c08.')).toEqual([
      'mention://scheduledScript:6a6c9342f8e10b2477900c08',
    ])
  })
})
