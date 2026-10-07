import type { ReactNode } from 'react';
import type { DateFilterResult } from '../../ui/date-picker';

/** The tag colour a log severity is drawn in. */
export type LogStatusVariant = 'success' | 'warning' | 'error' | 'grey' | 'critical';

/** One row of the logs table, as plain display data. */
export interface UiLogEntry {
  id: string;
  logId: string;
  /** Already formatted for display. */
  timestamp: string;
  status: {
    label: string;
    variant?: LogStatusVariant;
  };
  source: {
    name: string;
    toolType: string;
    icon?: ReactNode;
  };
  device: {
    name: string;
    organization?: string;
  };
  description: {
    title: string;
    details?: string;
  };
}

/** A filter choice of a column header and of the mobile filter modal. */
export interface LogsTableFilterOption {
  id: string;
  label: string;
  value: string;
}

/** What the table can be filtered by, as the API reports it. */
export interface LogsTableFacets {
  severities: readonly string[];
  toolTypes: readonly string[];
  /** Ready-made options: the caller owns how an organization is labelled. */
  organizations: readonly LogsTableFilterOption[];
}

/** The applied date sort and range, and how a new one is committed. */
export interface LogsTableDateFilter {
  sortDirection: 'asc' | 'desc';
  range: DateFilterResult['range'];
  onApply: (result: DateFilterResult) => void;
}

/** The columns of the logs table, by id. */
export type LogsTableColumnId = 'logId' | 'status' | 'tool' | 'source' | 'description' | 'copy' | 'quickView' | 'open';

/** The tag colour for a severity as the API spells it. */
export function logSeverityVariant(severity: string): LogStatusVariant {
  switch (severity) {
    case 'ERROR':
      return 'error';
    case 'WARNING':
      return 'warning';
    case 'INFO':
      return 'grey';
    case 'CRITICAL':
      return 'critical';
    default:
      return 'success';
  }
}
