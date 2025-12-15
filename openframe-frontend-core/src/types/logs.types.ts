import type { ToolType } from './tool.types'

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

export interface LogEntry {
  id: string
  ingestDay: string
  eventType: string
  severity: LogSeverity
  title: string
  timestamp: string | Date
  toolType?: ToolType
  toolIcon?: string
  message?: string
  metadata?: Record<string, any>
}

export interface LogsListProps {
  logs: LogEntry[]
  maxHeight?: string | number
  showConnector?: boolean
  onLogClick?: (log: LogEntry) => void
  loading?: boolean
  emptyMessage?: string
  className?: string
}

export interface LogSeverityDotProps {
  severity: LogSeverity
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface ToolIconProps {
  toolType: ToolType
  size?: number
  className?: string
}

export const LOG_SEVERITY_COLORS: Record<LogSeverity, string> = {
  DEBUG: '#888888',
  INFO: '#888888',
  WARNING: '#e1b32f',
  ERROR: '#f36666',
  CRITICAL: '#b43b3b'
}

export const LOG_SEVERITY_LABELS: Record<LogSeverity, string> = {
  DEBUG: 'Debug',
  INFO: 'Info',
  WARNING: 'Warning',
  ERROR: 'Error',
  CRITICAL: 'Critical'
}