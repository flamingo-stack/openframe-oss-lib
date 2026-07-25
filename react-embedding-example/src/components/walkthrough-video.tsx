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
  const { video } = useWalkthroughVideo({
    endpoint: EP.walkthroughVideo,
    transformCaptionsUrl: (rel) => `${CONTENT_PREFIX}${rel}`,
  })

  return (
    <FloatingWalkthroughVideo
      video={video}
    />
  )
}
