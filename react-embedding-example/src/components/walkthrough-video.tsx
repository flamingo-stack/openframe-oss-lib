import {
  FloatingWalkthroughVideo,
  useWalkthroughVideo,
} from '@flamingo-stack/openframe-frontend-core/components/features'
import { EP } from '../config/endpoints'

/**
 * Embedder-side mount of the lib's <FloatingWalkthroughVideo>. Fetching is the
 * lib's `useWalkthroughVideo` hook (SSOT). The RELATIVE `/api/captions/...`
 * captionsUrl is rebased onto the /content proxy automatically — the hook
 * derives the captions base from `ChatRuntime.endpoints.imageProxyUrlPrefix`
 * (og-placeholder pattern), so no captions wiring exists here.
 */
export function WalkthroughVideo() {
  const { video } = useWalkthroughVideo({
    endpoint: EP.walkthroughVideo,
  })

  return (
    <FloatingWalkthroughVideo
      video={video}
    />
  )
}
