'use client'

/**
 * @deprecated The canonical implementation lives at
 * `@flamingo-stack/openframe-frontend-core/utils` as `embed-authed-fetch.ts`.
 *
 * This shim preserves the legacy `chatAuthedFetch` name so existing
 * chat-namespace callers keep compiling. New code (chat OR ticket center)
 * should import from `…/utils` directly:
 *
 *   import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils'
 *
 * Wire headers (`X-Chat-Act-As`, etc.) are unchanged — that's a server
 * contract the rename intentionally does NOT touch.
 */

export { embedAuthedFetch as chatAuthedFetch } from '../../../utils/embed-authed-fetch'
