import type { QueryResultRow } from './types'

/**
 * Derive column names from data rows.
 * If `columnOrder` is provided, those keys come first; remaining keys are appended
 * in the order they appear in the first row.
 */
export function deriveColumns(
  data: QueryResultRow[],
  columnOrder?: string[]
): string[] {
  if (data.length === 0) return []

  const allKeys = Object.keys(data[0])

  if (!columnOrder || columnOrder.length === 0) {
    return allKeys
  }

  // Start with ordered keys that actually exist in the data
  const ordered = columnOrder.filter((key) => allKeys.includes(key))
  // Append any remaining keys not in the explicit order
  const remaining = allKeys.filter((key) => !columnOrder.includes(key))

  return [...ordered, ...remaining]
}

/**
 * Escape a CSV cell value — wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCSVCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Export data as a CSV file.
 */
export function exportToCSV(
  data: QueryResultRow[],
  columns: string[],
  filename: string
): void {
  if (data.length === 0 || columns.length === 0) return

  const header = columns.map(escapeCSVCell).join(',')
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col]
        if (value === null || value === undefined) return ''
        return escapeCSVCell(String(value))
      })
      .join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
