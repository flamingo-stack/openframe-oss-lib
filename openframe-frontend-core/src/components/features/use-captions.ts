'use client'

/**
 * useCaptions — THE captions configurer.
 *
 * The ONE place in the lib that reads the chat-runtime endpoints
 * (`endpoints.captionsUrlPrefix`) for caption purposes. Every caption
 * consumer (`EntityVideoSection`, `ReleaseDetailPage`,
 * `OnboardingGuideDetailView`, `useWalkthroughVideo`, …) calls this hook and
 * uses the returned pre-bound helpers — no component reads runtime endpoint
 * values for captions itself.
 *
 * The pure derivation logic lives in `captions-url.ts` (endpoint-agnostic,
 * server-import-safe); this hook only binds it to the ambient runtime.
 */

import { useMemo } from 'react'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import {
  getEntityCaptionUrls,
  getEntityCaptionUrlsById,
  rebaseCaptionsUrl,
  type CaptionSrtFields,
  type EntityCaptionUrls,
} from './captions-url'

export interface CaptionsApi {
  /** Both track URLs from an entity row's SRT columns (presence-gated). */
  forEntity: (entityType: string, entity: CaptionSrtFields | null | undefined) => EntityCaptionUrls
  /** Both track URLs from entity identity alone (no SRT knowledge — chat cards). */
  forEntityId: (entityType: string, entityId: string | number) => Required<EntityCaptionUrls>
  /** Rebase an already-built relative `/api/captions/...` URL onto the host base. */
  rebase: <T extends string | null | undefined>(url: T) => T | string
}

export function useCaptions(): CaptionsApi {
  const endpoints = useChatRuntime()?.endpoints ?? null
  return useMemo(
    () => ({
      forEntity: (entityType, entity) => getEntityCaptionUrls(endpoints, entityType, entity),
      forEntityId: (entityType, entityId) => getEntityCaptionUrlsById(endpoints, entityType, entityId),
      rebase: (url) => rebaseCaptionsUrl(endpoints, url),
    }),
    [endpoints],
  )
}
