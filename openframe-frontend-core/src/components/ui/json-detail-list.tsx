'use client'

import * as React from 'react'
import { formatRelativeTime } from '../../utils/date-utils'
import { cn } from '../../utils/cn'

/**
 * THE generic JSON detail renderer — readable key/value prose for machine
 * payloads whose field names are NOT guaranteed (evidence blobs, audit
 * payloads, webhook bodies). No schema knowledge: keys are humanised,
 * ISO-dates become relative times, nested objects indent, and anything
 * unparseable falls back to raw. Use this instead of `<pre>{JSON.stringify}`
 * or a per-shape bespoke renderer.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function Value({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-ods-text-secondary">—</span>
  }
  if (typeof value === 'string') {
    if (ISO_DATE.test(value)) {
      return (
        <span title={value} className="text-ods-text-secondary">
          {formatRelativeTime(value)}
        </span>
      )
    }
    return <span className="whitespace-pre-wrap text-ods-text-primary">{value}</span>
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-code text-ods-text-primary">{String(value)}</span>
  }
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return <span className="text-ods-text-primary">{value.join(', ')}</span>
    }
    return (
      <div className="space-y-[var(--spacing-system-xxs)]">
        {value.map((v, i) => (
          <Value key={i} value={v} depth={depth + 1} />
        ))}
      </div>
    )
  }
  if (typeof value === 'object' && depth < 3) {
    return <JsonDetailList data={value} depth={depth + 1} />
  }
  return (
    <pre className="whitespace-pre-wrap text-code text-ods-text-secondary">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export interface JsonDetailListProps {
  /** Object, array, JSON string, or any scalar — rendered faithfully either way. */
  data: unknown
  /** Internal nesting level — leave at the default from call sites. */
  depth?: number
}

export function JsonDetailList({ data, depth = 0 }: JsonDetailListProps) {
  let parseFailed = false
  const obj =
    typeof data === 'string'
      ? (() => {
          try {
            return JSON.parse(data) as unknown
          } catch {
            parseFailed = true
            return null
          }
        })()
      : data

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    // A string that ISN'T JSON is prose — show it as-is.
    if (typeof data === 'string' && parseFailed) {
      return <p className="whitespace-pre-wrap text-h6 text-ods-text-primary">{data}</p>
    }
    // Everything else is a real (parsed or given) non-object VALUE — an array,
    // scalar, or null. Render the value through `Value`, never the source
    // string: `'["a","b"]'` must render as the array, not as raw JSON text.
    return (
      <div className="text-h6">
        <Value value={obj} depth={depth} />
      </div>
    )
  }

  return (
    <dl
      className={cn(
        'space-y-[var(--spacing-system-xsf)]',
        depth > 0 && 'pl-[var(--spacing-system-sf)] border-l border-ods-border',
      )}
    >
      {Object.entries(obj as Record<string, unknown>).map(([key, value]) => (
        <div key={key}>
          <dt className="text-h6 text-ods-text-secondary">{humanizeKey(key)}</dt>
          <dd className="text-h6">
            <Value value={value} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
