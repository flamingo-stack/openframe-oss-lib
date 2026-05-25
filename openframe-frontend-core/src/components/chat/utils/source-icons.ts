/**
 * Client-side re-export shim. Source-icons data + helpers live in
 * `src/utils/source-icons.ts` (server-safe, no `'use client'` banner)
 * so server-side hub code can call them. Chat-side consumers continue
 * importing from this path via the chat-utils barrel.
 */
export {
  SOURCE_ICON_NAMES,
  getSourceIconName,
  SOURCE_LABELS_BY_TABLE,
  getSourceLabel,
  DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID,
  defaultTableIdForDocumentType,
} from '../../../utils/source-icons'
