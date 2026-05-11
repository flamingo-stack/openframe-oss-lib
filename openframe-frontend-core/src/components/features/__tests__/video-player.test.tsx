import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Regression test for the case-study video performance fix:
 *   plan: /Users/michaelassraf/.claude/plans/we-have-terrible-serious-radiant-turing.md
 *
 * Bug: VideoPlayer mounted two competing <video> elements on every render when no
 * `poster` prop was passed — the hidden first-frame extractor (`useVideoFirstFramePoster`)
 * raced ReactPlayer's own metadata fetch on the same URL, doubling bandwidth and
 * stalling click-to-play on big MP4s.
 *
 * Fix: opt-in `lazyMount` prop that:
 *   1. Skips `useVideoFirstFramePoster` (no hidden video)
 *   2. Sets `preload="none"` on ReactPlayer's <video> until user clicks play
 *   3. Synchronously calls .play() in the click handler for iOS user-activation safety
 *
 * Test strategy:
 *   - To detect "did the hidden poster <video> get created?", we tag the hook's
 *     unique signature — it sets `crossOrigin="anonymous"` on the element. Spy on
 *     `document.createElement` and count VIDEO elements that subsequently have
 *     `crossOrigin` set. React's own DOM render does NOT set crossOrigin on the
 *     mocked <video>, so this isolates the bug surface cleanly.
 *   - Mock `react-player` so we don't depend on its internal FilePlayer dynamic
 *     import (broken under JSDOM / Vitest's module loader).
 */

// Mock react-player as a forwardRef component that exposes the same
// `getInternalPlayer()` surface used by VideoPlayer (line ~697 lazyMount sync play).
// Without this, `playerRef.current?.getInternalPlayer()` returns undefined under
// the test, the `instanceof HTMLVideoElement` guard fails, and the iOS user-
// activation path is silently never exercised by the test.
vi.mock('react-player', async () => {
  const React = await import('react')
  const RP = React.forwardRef<
    { getInternalPlayer: () => HTMLVideoElement | null },
    { url: string; config?: { file?: { attributes?: Record<string, unknown> } } }
  >(function MockReactPlayer({ url, config }, ref) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null)
    React.useImperativeHandle(ref, () => ({
      getInternalPlayer: () => videoRef.current,
    }))
    const preload = (config?.file?.attributes?.preload as string) ?? 'metadata'
    return <video ref={videoRef} src={url} preload={preload as 'none' | 'metadata' | 'auto'} />
  })
  return { default: RP }
})

beforeAll(() => {
  // JSDOM doesn't implement these — react-player's internals (and the poster hook) call them.
  Object.defineProperty(HTMLMediaElement.prototype, 'canPlayType', {
    value: () => 'maybe',
    writable: true,
    configurable: true,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    value: () => undefined,
    writable: true,
    configurable: true,
  })
})

import { VideoPlayer } from '../video-player'

const SAMPLE_MP4 = 'https://example.com/test.mp4'

/**
 * Detects the poster hook's signature via the `data-poster-extractor` attribute
 * the hook sets on its hidden <video>. This is more durable than checking
 * `crossOrigin === 'anonymous'` (any future code that happens to set crossOrigin
 * on a freshly-created video would inflate the count and silently flake-pass).
 */
function spyForHiddenPosterVideos(): { count: () => number; restore: () => void } {
  const original = document.createElement.bind(document)
  const tracked: HTMLVideoElement[] = []
  document.createElement = ((tag: string, opts?: ElementCreationOptions) => {
    const el = original(tag, opts)
    if (tag.toLowerCase() === 'video') tracked.push(el as HTMLVideoElement)
    return el
  }) as typeof document.createElement
  return {
    count: () => tracked.filter(v => v.getAttribute('data-poster-extractor') === 'true').length,
    restore: () => { document.createElement = original },
  }
}

describe('VideoPlayer lazyMount', () => {
  let videoSpy: ReturnType<typeof spyForHiddenPosterVideos> | null = null

  afterEach(() => {
    videoSpy?.restore()
    videoSpy = null
  })

  it('does NOT instantiate a hidden poster <video> when lazyMount=true (the actual fix)', () => {
    videoSpy = spyForHiddenPosterVideos()
    render(<VideoPlayer url={SAMPLE_MP4} lazyMount />)
    expect(videoSpy.count()).toBe(0)
  })

  it('renders ReactPlayer with preload="none" pre-click when lazyMount=true', () => {
    const { container } = render(<VideoPlayer url={SAMPLE_MP4} lazyMount />)
    const videos = container.querySelectorAll('video')
    expect(videos.length).toBe(1)
    expect(videos[0].getAttribute('preload')).toBe('none')
  })

  it('preserves existing preload="metadata" + poster-hook behavior when lazyMount=false (default)', () => {
    videoSpy = spyForHiddenPosterVideos()
    const { container } = render(<VideoPlayer url={SAMPLE_MP4} />)
    expect(container.querySelectorAll('video')[0].getAttribute('preload')).toBe('metadata')
    // The poster hook DOES create one hidden <video> when no poster is provided.
    // This is the legacy behavior we explicitly opted out of via lazyMount.
    expect(videoSpy.count()).toBeGreaterThanOrEqual(1)
  })

  it('skips the poster hook when an explicit poster is provided (existing gate, regression check)', () => {
    videoSpy = spyForHiddenPosterVideos()
    render(<VideoPlayer url={SAMPLE_MP4} poster="https://example.com/poster.jpg" />)
    expect(videoSpy.count()).toBe(0)
  })

  it('calls play() synchronously inside the click handler when lazyMount=true (iOS user-activation)', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      value: playSpy,
      writable: true,
      configurable: true,
    })

    const { container } = render(<VideoPlayer url={SAMPLE_MP4} lazyMount />)
    // The play overlay div has `onClick={handlePlayClick}` and uses the
    // 'group cursor-pointer' classes. Find by role/aria isn't reliable since
    // the overlay is a styled div, so query by the unique class combo.
    const overlay = container.querySelector('div.cursor-pointer.group') as HTMLElement | null
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay!)
    // play() must be called synchronously inside the click event task — if it
    // were deferred (e.g., to a useEffect), iOS Safari would block playback.
    expect(playSpy).toHaveBeenCalled()
  })
})
