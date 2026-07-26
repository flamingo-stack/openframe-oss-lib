import { useCallback } from 'react'
import {
  FloatingWalkthroughVideo,
  useWalkthroughVideo,
} from '@flamingo-stack/openframe-frontend-core/components/features'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

/**
 * Embedder-side mount of the lib's <FloatingWalkthroughVideo>. Fetching is the
 * lib's `useWalkthroughVideo` hook (SSOT) — the RELATIVE captionsUrl is routed
 * back through the /content proxy via `transformCaptionsUrl`.
 */
export function WalkthroughVideo() {
  // Stable identity: an inline arrow makes React Query re-run `select` every
  // render, producing a fresh video object and restarting the widget's
  // appear-delay timer on any parent re-render.
  const transformCaptionsUrl = useCallback((rel: string) => `${CONTENT_PREFIX}${rel}`, [])

  const { video } = useWalkthroughVideo({
    endpoint: EP.walkthroughVideo,
    transformCaptionsUrl,
  })

  return (
    <FloatingWalkthroughVideo
      video={video}
    />
  )
}
