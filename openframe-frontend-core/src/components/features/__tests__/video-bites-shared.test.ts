import { describe, expect, it } from 'vitest'
import {
  sortBitesByCreatedAtDesc,
  sortBitesByFeaturedAtDesc,
} from '../video-bites-shared'
import type { VideoTeaser } from '../../../types/video-processing'

const bite = (overrides: Partial<VideoTeaser>): VideoTeaser => ({
  url: `https://cdn.example/${Math.abs(JSON.stringify(overrides).length)}.mp4`,
  ...overrides,
})

describe('sortBitesByCreatedAtDesc', () => {
  it('orders newest created_at first', () => {
    const a = bite({ created_at: '2026-01-01T00:00:00Z' })
    const b = bite({ created_at: '2026-02-01T00:00:00Z' })
    expect([a, b].sort(sortBitesByCreatedAtDesc)).toEqual([b, a])
  })

  it('sorts bites without created_at last', () => {
    const dated = bite({ created_at: '2026-01-01T00:00:00Z' })
    const undated = bite({})
    expect([undated, dated].sort(sortBitesByCreatedAtDesc)).toEqual([dated, undated])
  })
})

describe('sortBitesByFeaturedAtDesc', () => {
  it('ranks a recently-featured OLD bite above a newer un-restamped one', () => {
    // The 2026-08-18 homepage regression: an old clip starred today must
    // outrank clips created later but featured earlier.
    const oldClipFeaturedToday = bite({
      created_at: '2026-07-14T00:00:00Z',
      featured_at: '2026-08-18T00:00:00Z',
    })
    const newerClipNoStamp = bite({ created_at: '2026-07-17T00:00:00Z' })
    expect([newerClipNoStamp, oldClipFeaturedToday].sort(sortBitesByFeaturedAtDesc)).toEqual([
      oldClipFeaturedToday,
      newerClipNoStamp,
    ])
  })

  it('ranks by featured_at only — created_at never influences featured order', () => {
    // No date-fallback ranking: all featured bites carry the stamp (write
    // path + 2026-08-19 backfill).
    const staleStampNewClip = bite({
      created_at: '2026-08-01T00:00:00Z',
      featured_at: '2026-01-01T00:00:00Z',
    })
    const freshStampOldClip = bite({
      created_at: '2026-01-01T00:00:00Z',
      featured_at: '2026-08-01T00:00:00Z',
    })
    expect([staleStampNewClip, freshStampOldClip].sort(sortBitesByFeaturedAtDesc)).toEqual([
      freshStampOldClip,
      staleStampNewClip,
    ])
  })

  it('sorts unstamped bites last (mid-deploy transient only)', () => {
    const stamped = bite({ featured_at: '2026-01-01T00:00:00Z' })
    const bare = bite({ created_at: '2026-08-01T00:00:00Z' })
    expect([bare, stamped].sort(sortBitesByFeaturedAtDesc)).toEqual([stamped, bare])
  })
})
