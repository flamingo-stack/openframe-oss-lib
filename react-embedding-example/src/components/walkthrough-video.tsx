import { useEffect, useState } from 'react'
import {
  FloatingWalkthroughVideo,
  type WalkthroughVideoData,
} from '@flamingo-stack/openframe-frontend-core/components/features'
import { RichMarkdownRenderer } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

/**
 * Embedder-side mount of the lib's <FloatingWalkthroughVideo>. Mounted like
 * ask-ai.tsx (which just mounts a lib component); the FETCH is new here.
 *
 * The public API returns the RAW body `{ walkthroughVideo }` (no {success,data}
 * wrapper). The video's `captionsUrl` is a RELATIVE `/api/captions/...` path;
 * we prefix it with the proxy prefix so it routes back through /content.
 */
export function WalkthroughVideo() {
  const [video, setVideo] = useState<WalkthroughVideoData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(EP.walkthroughVideo)
      .then((r) => (r.ok ? r.json() : { walkthroughVideo: null }))
      .then((body: { walkthroughVideo: WalkthroughVideoData | null }) => {
        if (cancelled) return
        const wv = body?.walkthroughVideo ?? null
        if (wv?.captionsUrl && wv.captionsUrl.startsWith('/')) {
          wv.captionsUrl = `${CONTENT_PREFIX}${wv.captionsUrl}`
        }
        setVideo(wv)
      })
      .catch(() => { if (!cancelled) setVideo(null) })
    return () => { cancelled = true }
  }, [])

  return (
    <FloatingWalkthroughVideo
      video={video}
      MarkdownRenderer={RichMarkdownRenderer}
    />
  )
}
