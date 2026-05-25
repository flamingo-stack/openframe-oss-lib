'use client'

/**
 * Click-to-expand handler for chat-attachment images in the chat thread.
 *
 * Returns `{ panelRef, modal }`:
 *   - `panelRef` — attach to the chat content wrapper. The hook
 *     installs a delegated `click` listener on this ref.
 *   - `modal` — render as a sibling of the chat panel (so it lives
 *     OUTSIDE any overflow-hidden message bubbles). Returns `null`
 *     while closed.
 *
 * Behavior on click:
 *   1. Filter for `<img>` whose `src` starts with the runtime's
 *      `attachmentViewUrlPrefix` (so non-chat images don't intercept).
 *   2. Walk up to the nearest `[data-message-role]` ancestor — the
 *      boundary the chat-shell wraps each message bubble with.
 *   3. Collect ALL chat-attachment `<img>`s inside that boundary in
 *      DOM order. Compute the clicked index for `initialIndex`.
 *   4. Open `ImageGalleryModal` (UI-Kit, also used by
 *      `roadmap-card.tsx` for screenshot expansion).
 *
 * The hook deliberately owns the click DOM-walk + modal state so
 * the host component consumes a single `{panelRef, modal}` API.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageGalleryModal } from '../../ui/image-gallery-modal'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'

interface GalleryState {
  isOpen: boolean
  images: string[]
  initialIndex: number
}

const CLOSED: GalleryState = { isOpen: false, images: [], initialIndex: 0 }

export function useChatAttachmentImageGallery() {
  const runtime = useRequiredChatRuntime()
  const viewUrlPrefix = runtime.endpoints.attachmentViewUrlPrefix
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<GalleryState>(CLOSED)

  const handleClose = useCallback(() => setState(CLOSED), [])

  useEffect(() => {
    const root = panelRef.current
    if (!root) return

    const onClick = (ev: Event) => {
      const target = ev.target as HTMLElement | null
      if (!target) return
      // Match an <img> whose `src` starts with the proxy URL prefix.
      const img = target.closest('img') as HTMLImageElement | null
      if (!img || !img.src.startsWith(absolutize(viewUrlPrefix))) return

      // Walk up to the message-bubble boundary.
      const bubble = img.closest('[data-message-role]')
      if (!bubble) {
        // Fallback: open the modal with just the clicked image.
        ev.preventDefault()
        setState({ isOpen: true, images: [img.src], initialIndex: 0 })
        return
      }

      // Collect all chat-attachment images inside this bubble in DOM
      // order. The `closest` lookup matched img.src.startsWith already,
      // but we re-check below because `querySelectorAll` returns ALL
      // <img>s in the bubble (avatar images etc.).
      const allImgs = Array.from(bubble.querySelectorAll('img')) as HTMLImageElement[]
      const matching = allImgs.filter((el) => el.src.startsWith(absolutize(viewUrlPrefix)))
      if (matching.length === 0) return

      const idx = Math.max(0, matching.indexOf(img))
      ev.preventDefault()
      setState({
        isOpen: true,
        images: matching.map((el) => el.src),
        initialIndex: idx,
      })
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [viewUrlPrefix])

  // `ImageGalleryModal` doesn't accept `null` for `images` — render
  // it only when open. Closing returns `null` so the modal unmounts
  // and React garbage-collects any blob URLs it might hold.
  const modal = state.isOpen ? (
    <ImageGalleryModal
      images={state.images}
      isOpen={state.isOpen}
      onClose={handleClose}
      initialIndex={state.initialIndex}
    />
  ) : null

  return { panelRef, modal }
}

/** Absolutize a prefix for comparison against `<img>.src`. Browsers
 *  resolve `<img src="/api/storage/view/...">` to an absolute URL when
 *  reading `.src` — we need the same shape on the prefix to match.
 *
 *  Embedded apps that supply an absolute prefix already work as-is
 *  (the prefix matches `.src` directly). For relative prefixes (host
 *  mode), prefix with `window.location.origin`. */
function absolutize(prefix: string): string {
  if (prefix.startsWith('http://') || prefix.startsWith('https://')) return prefix
  if (typeof window === 'undefined') return prefix
  return `${window.location.origin}${prefix.startsWith('/') ? '' : '/'}${prefix}`
}
