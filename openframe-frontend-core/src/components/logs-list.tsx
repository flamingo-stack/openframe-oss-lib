import { type FC, forwardRef, useRef } from 'react';
import type { LogsListProps, LogEntry } from '../types/logs.types';
import { cn } from '../utils/cn';
import { LogSeverityDot } from './log-severity-dot';
import { ToolIcon } from './tool-icon';

const formatTimestamp = (timestamp: string | Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  // UTC getters so the timestamp is identical on server (UTC) and client
  // (local) — otherwise React #418 hydration mismatch.
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}/${month}/${day},${hours}:${minutes}`;
};

const LogCard: FC<{
  log: LogEntry;
  isLast: boolean;
  showConnector: boolean;
  onClick?: () => void;
}> = ({ log, isLast, showConnector, onClick }) => {
  return (
    <div className="relative">
      <div
        className={cn(
          'relative box-border flex w-full items-start gap-3 rounded px-1 py-2',
          'cursor-pointer transition-colors hover:bg-ods-bg-hover/50',
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <LogSeverityDot severity={log.severity} size="md" />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-ods-text-primary text-h6">{log.title}</p>
          <div className="flex items-center gap-2">
            <p className="text-ods-text-secondary text-h5">{formatTimestamp(log.timestamp)}</p>
            {log.toolType && <ToolIcon toolType={log.toolType} size={16} />}
          </div>
        </div>
      </div>

      {showConnector && !isLast && (
        <div
          className="absolute left-[15px] w-[2px] bg-ods-border"
          style={{
            top: '28px',
            bottom: '-10px',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export const LogsList = forwardRef<HTMLDivElement, LogsListProps>(
  (
    {
      logs,
      maxHeight = '400px',
      showConnector = true,
      onLogClick,
      loading = false,
      emptyMessage = 'No logs to display',
      className,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const isFullHeight = maxHeight === '100%';

    const getContainerStyles = () => {
      if (isFullHeight) return undefined;
      return { maxHeight, minHeight: '200px' };
    };

    const getContainerClasses = () => {
      if (isFullHeight) return 'h-full';
      return '';
    };

    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-lg border border-ods-border bg-ods-card p-4',
            'flex items-center justify-center',
            getContainerClasses(),
            className,
          )}
          style={getContainerStyles()}
        >
          <div className="text-ods-text-muted text-h6">Loading logs...</div>
        </div>
      );
    }

    if (logs.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-lg border border-ods-border bg-ods-card p-4',
            'flex items-center justify-center',
            getContainerClasses(),
            className,
          )}
          style={getContainerStyles()}
        >
          <div className="text-ods-text-muted text-h6">{emptyMessage}</div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-lg border border-ods-border bg-ods-card',
          'flex flex-col overflow-hidden',
          getContainerClasses(),
          className,
        )}
        style={getContainerStyles()}
      >
        <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
          {logs.map((log, index) => (
            <LogCard
              key={log.id}
              log={log}
              isLast={index === logs.length - 1}
              showConnector={showConnector}
              onClick={() => onLogClick?.(log)}
            />
          ))}
        </div>
      </div>
    );
  },
);

LogsList.displayName = 'LogsList';
