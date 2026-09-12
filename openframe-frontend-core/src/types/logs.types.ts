import type { ToolType } from './tool.types';

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  id: string;
  ingestDay: string;
  eventType: string;
  severity: LogSeverity;
  title: string;
  timestamp: string | Date;
  toolType?: ToolType;
  toolIcon?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface LogsListProps {
  logs: LogEntry[];
  maxHeight?: string | number;
  showConnector?: boolean;
  onLogClick?: (log: LogEntry) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export interface LogSeverityDotProps {
  severity: LogSeverity;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LOG_SEVERITY_COLORS: Record<LogSeverity, string> = {
  DEBUG: 'var(--text-ods-secondary)',
  INFO: 'var(--text-ods-secondary)',
  WARNING: 'var(--text-ods-warning)',
  ERROR: 'var(--text-ods-error)',
  CRITICAL: 'var(--text-ods-error)',
};

export const LOG_SEVERITY_LABELS: Record<LogSeverity, string> = {
  DEBUG: 'Debug',
  INFO: 'Info',
  WARNING: 'Warning',
  ERROR: 'Error',
  CRITICAL: 'Critical',
};

