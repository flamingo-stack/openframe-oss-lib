'use client'

/**
 * Chat-attachment upload state machine.
 *
 * Multi-file state (precedent: hub `components/blog/image-upload-manager.tsx`).
 * Magic-byte sniff via `file-type` BEFORE upload (rejects extension
 * spoofs like `evil.exe` renamed `screenshot.png`). Per-attachment
 * `AbortController` for clean remove-mid-upload.
 *
 * Auth propagation:
 *   - `chatAuthedFetch` carries bearer-act-as headers + Supabase
 *     session cookies — used both for minting the upload URL and as
 *     the auth path before falling through to the signed PUT.
 *   - The byte-PUT to the signed URL uses an inline `uploadWithProgress`
 *     XHR helper (ported from the hub `unified-upload-service`) so the
 *     lib-side chat hook is self-contained.
 *
 * URL endpoint: `runtime.endpoints.attachmentUploadUrl` (hub default
 * `/api/storage/generate-upload-url`). Embedded apps override.
 *
 * Dedup: files keyed by `(name, size, lastModified)` — second pick of
 * the same file is silently ignored.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { fileTypeFromBlob } from 'file-type'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import {
  CHAT_ATTACHMENT_MIME_TYPES,
  CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER,
} from '../chat-attachment-bar'
import type { ChatAttachment } from '../utils/chat-attachment-markdown'

// ---------------------------------------------------------------------------
// Inlined hub-side constants (single source of truth — `lib/config/
// chat-attachment-config.ts` on the hub). Hard-coded here so the lib
// hook is self-contained; if hub-side bumps the cap, update both.
// ---------------------------------------------------------------------------

const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
const CHAT_ATTACHMENTS_FOLDER = 'chat'
const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024

/** Cache-Control header for content-addressed uploads — Storage paths
 *  embed `{timestamp}-{random}-{filename}` so a given URL is immutable. */
const STORAGE_CACHE_CONTROL_IMMUTABLE = 'public, max-age=31536000, immutable'

type Status = 'sniffing' | 'uploading' | 'ready' | 'error'

/** Internal staged-attachment shape (more fields than the wire
 *  `ChatAttachment` — carries state-machine metadata). */
export interface StagedAttachment {
  /** Stable client-side id; survives across re-renders. */
  id: string
  file: File
  status: Status
  /** Set when `status === 'ready'`. Server-issued. */
  storagePath?: string
  /** Set when `status === 'ready'`. Server-issued HMAC view token. */
  viewToken?: string
  /** 0-100 during 'uploading'. */
  progress: number
  /** Set when `status === 'error'`. */
  errorMessage?: string
}

/** Response shape from `/api/storage/generate-upload-url`. */
interface UploadUrlResponse {
  uploadUrl: string
  filePath: string
  token: string
  bucket: string
  publicUrl: string | null
  viewToken: string | null
}

interface UseChatAttachmentsApi {
  attachments: StagedAttachment[]
  /** All staged files in 'ready' state, projected to the wire
   *  `ChatAttachment` shape — pass to `sendMessage`'s `pendingAttachments`. */
  readyAttachments: ChatAttachment[]
  /** True iff any attachment is mid-upload — Send button reads this
   *  to disable itself. */
  hasInflightUploads: boolean
  addFiles: (files: FileList | File[]) => void
  removeAttachment: (id: string) => void
  clear: () => void
}

/**
 * Inline `uploadWithProgress` — XHR PUT to a Supabase signed-upload URL
 * with progress + abort support. Ported verbatim from the hub
 * `unified-upload-service.ts`. Maps the XHR 0-100 to the caller's 10-95
 * range (leaving 0-10 for the mint + 95-100 for state transitions).
 *
 * AbortSignal wiring: `signal?.addEventListener('abort', () => xhr.abort())`
 * — without this, calling `removeAttachment`/`clear()` aborts the
 * controller but the XHR runs to completion and bytes still land in
 * Supabase.
 */
function uploadWithProgress(
  url: string,
  file: File,
  token: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Upload cancelled'))
      return
    }
    const xhr = new XMLHttpRequest()
    let isCompleted = false

    const cleanup = () => {
      if (isCompleted) return
      isCompleted = true
      xhr.upload.removeEventListener('progress', handleProgress)
      xhr.removeEventListener('load', handleLoad)
      xhr.removeEventListener('error', handleError)
      xhr.removeEventListener('abort', handleAbort)
      xhr.removeEventListener('timeout', handleTimeout)
      signal?.removeEventListener('abort', handleSignalAbort)
      if (xhr.readyState !== XMLHttpRequest.DONE) xhr.abort()
    }

    const handleProgress = (event: ProgressEvent) => {
      if (event.lengthComputable && onProgress) {
        // Map 0-100 of network progress to 10-95.
        const pct = 10 + (event.loaded / event.total) * 85
        onProgress(Math.round(pct))
      }
    }

    const handleLoad = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}: ${xhr.responseText || xhr.statusText}`,
          ),
        )
      }
    }

    const handleError = () => {
      cleanup()
      reject(new Error('Network error during upload'))
    }
    const handleAbort = () => {
      cleanup()
      reject(new Error('Upload cancelled'))
    }
    const handleTimeout = () => {
      cleanup()
      reject(new Error('Upload timed out'))
    }
    const handleSignalAbort = () => {
      xhr.abort()
    }
    signal?.addEventListener('abort', handleSignalAbort, { once: true })

    xhr.upload.addEventListener('progress', handleProgress)
    xhr.addEventListener('load', handleLoad)
    xhr.addEventListener('error', handleError)
    xhr.addEventListener('abort', handleAbort)
    xhr.addEventListener('timeout', handleTimeout)

    xhr.open('PUT', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    // `x-upsert: true` — signed upload tokens can target the same path
    // more than once on retry; without this header, Storage returns 409
    // on the second attempt instead of overwriting.
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('cache-control', STORAGE_CACHE_CONTROL_IMMUTABLE)
    xhr.timeout = 30 * 60 * 1000
    xhr.send(file)
  })
}

export function useChatAttachments(): UseChatAttachmentsApi {
  const runtime = useRequiredChatRuntime()
  const uploadUrlEndpoint = runtime.endpoints.attachmentUploadUrl

  const [attachments, setAttachments] = useState<StagedAttachment[]>([])
  // AbortControllers indexed by attachment id. Survives re-renders.
  const controllersRef = useRef<Map<string, AbortController>>(new Map())

  const updateOne = useCallback((id: string, patch: Partial<StagedAttachment>) => {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }, [])

  const removeAttachment = useCallback((id: string) => {
    // Abort any in-flight work for this attachment.
    const ctrl = controllersRef.current.get(id)
    if (ctrl) {
      ctrl.abort()
      controllersRef.current.delete(id)
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clear = useCallback(() => {
    for (const ctrl of controllersRef.current.values()) ctrl.abort()
    controllersRef.current.clear()
    setAttachments([])
  }, [])

  const uploadOne = useCallback(
    async (att: StagedAttachment) => {
      const ctrl = controllersRef.current.get(att.id)
      try {
        // 1. Magic-byte sniff. The `file` ARG is a Blob; `fileTypeFromBlob`
        //    reads the first few KB. Rejects extension spoofs.
        let sniffed: { mime: string } | undefined
        try {
          sniffed = await fileTypeFromBlob(att.file)
        } catch (err) {
          if (ctrl?.signal.aborted) return
          throw new Error(
            `Could not read file content: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
        if (ctrl?.signal.aborted) return
        if (!sniffed) {
          throw new Error('Unrecognized file format')
        }
        const actualMime = sniffed.mime
        if (!(CHAT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(actualMime)) {
          throw new Error(
            `File type "${actualMime}" is not allowed. ` +
              `Allowed: ${CHAT_ATTACHMENT_MIME_TYPES.join(', ')}`,
          )
        }

        // 2. Move to 'uploading' and POST the URL-mint request with
        //    bearer-act-as headers (if present).
        updateOne(att.id, { status: 'uploading', progress: 5 })

        const urlResp = await chatAuthedFetch(uploadUrlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl?.signal,
          body: JSON.stringify({
            fileName: att.file.name,
            // Pass the SNIFFED MIME (not `file.type`, which can be a
            // user-supplied lie) so the server's MIME pre-validation
            // matches reality.
            fileType: actualMime,
            bucket: CHAT_ATTACHMENTS_BUCKET,
            folder: CHAT_ATTACHMENTS_FOLDER,
          }),
        })

        if (!urlResp.ok) {
          const errBody = await urlResp.json().catch(() => ({}))
          throw new Error(errBody.error || `Failed to mint upload URL: ${urlResp.statusText}`)
        }

        const mintData = (await urlResp.json()) as UploadUrlResponse
        if (!mintData.viewToken) {
          throw new Error('Server did not return a viewToken for the chat-attachments bucket')
        }

        // 3. PUT the bytes via inline `uploadWithProgress`.
        await uploadWithProgress(
          mintData.uploadUrl,
          att.file,
          mintData.token,
          (pct) => {
            updateOne(att.id, { progress: pct })
          },
          ctrl?.signal,
        )

        if (ctrl?.signal.aborted) return

        // 4. Mark ready.
        updateOne(att.id, {
          status: 'ready',
          progress: 100,
          storagePath: mintData.filePath,
          viewToken: mintData.viewToken,
        })
      } catch (err) {
        if (ctrl?.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        updateOne(att.id, { status: 'error', progress: 0, errorMessage: message })
      } finally {
        controllersRef.current.delete(att.id)
      }
    },
    [uploadUrlEndpoint, updateOne],
  )

  // `attachmentsRef` mirrors the staged set for SYNCHRONOUS reads
  // during `addFiles`. Two assignment sites keep it in lockstep:
  //   (a) `attachmentsRef.current = attachments` after every render —
  //       picks up state mutations from `updateOne` / `removeAttachment`
  //       / `clear`.
  //   (b) `attachmentsRef.current = [...attachmentsRef.current,
  //       ...additions]` INSIDE `addFiles` BEFORE `setAttachments`
  //       commits — guarantees a SECOND `addFiles` call in the same
  //       tick sees the first call's additions for dedup.
  const attachmentsRef = useRef<StagedAttachment[]>([])
  attachmentsRef.current = attachments

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return

      // Compute additions OUTSIDE the setState updater — the updater
      // must be a pure function. React 18 StrictMode invokes updaters
      // TWICE in dev; concurrent transitions can do the same in prod.
      // If side effects (UUID gen, controllerRef.set, uploadOne) lived
      // inside, each render double-fired the upload.
      const prev = attachmentsRef.current
      const seen = new Set(
        prev.map((a) => `${a.file.name}|${a.file.size}|${a.file.lastModified}`),
      )
      const additions: StagedAttachment[] = []
      // `error`-status chips don't count toward the cap — they're
      // visual diagnostics, not active uploads. Without this filter
      // a single oversized-file mistake would block the user from
      // adding further files until they manually `×` the error chip.
      const remainingSlots = Math.max(
        0,
        CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER -
          prev.filter((a) => a.status !== 'error').length,
      )
      for (const file of arr) {
        if (additions.length >= remainingSlots) break
        const key = `${file.name}|${file.size}|${file.lastModified}`
        if (seen.has(key)) continue

        // Size pre-check — server-side bucket policy is the
        // authoritative gate, but rejecting here saves the user a
        // round-trip on obviously-too-big files.
        if (file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
          additions.push({
            id: crypto.randomUUID(),
            file,
            status: 'error',
            progress: 0,
            errorMessage: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 25 MB)`,
          })
          seen.add(key)
          continue
        }

        additions.push({
          id: crypto.randomUUID(),
          file,
          status: 'sniffing',
          progress: 0,
        })
        seen.add(key)
      }

      if (additions.length === 0) return

      // SYNCHRONOUSLY update the ref BEFORE the React commit. Without
      // this, a second `addFiles` call in the SAME tick (paste-then-drop
      // browser event sequence; touch-then-mouse on iOS hybrid; double
      // user clicks on the chip-strip's hidden file input) would read
      // the same stale `attachmentsRef.current` and bypass dedup.
      attachmentsRef.current = [...prev, ...additions]

      // Register AbortControllers + kick off uploads BEFORE the state
      // commit. The XHR doesn't depend on React state; `uploadOne`'s
      // `updateOne` calls are queued behind this `setAttachments`,
      // so by the time the first progress callback fires React has
      // already rendered the new chips.
      for (const a of additions) {
        if (a.status === 'sniffing') {
          const ctrl = new AbortController()
          controllersRef.current.set(a.id, ctrl)
          void uploadOne(a)
        }
      }

      // Pure updater — no side effects, idempotent under StrictMode
      // double-invocation.
      setAttachments((p) => [...p, ...additions])
    },
    [uploadOne],
  )

  // Memoized so `handleSend`'s `useCallback([readyAttachments, ...])`
  // doesn't re-create the handler (and re-render `ChatInput`) on every
  // unrelated re-render. Stable reference while the underlying
  // attachments array is unchanged.
  const readyAttachments: ChatAttachment[] = useMemo(
    () =>
      attachments
        .filter(
          (a): a is StagedAttachment & { storagePath: string; viewToken: string } =>
            a.status === 'ready' && !!a.storagePath && !!a.viewToken,
        )
        .map((a) => ({
          storagePath: a.storagePath,
          viewToken: a.viewToken,
          contentType: a.file.type,
          fileName: a.file.name,
          size: a.file.size,
        })),
    [attachments],
  )

  const hasInflightUploads = attachments.some(
    (a) => a.status === 'sniffing' || a.status === 'uploading',
  )

  return {
    attachments,
    readyAttachments,
    hasInflightUploads,
    addFiles,
    removeAttachment,
    clear,
  }
}
