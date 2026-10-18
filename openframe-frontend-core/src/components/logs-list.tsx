import { type FC, forwardRef, useRef } from 'react';
import type { LogsListProps, LogEntry } from '../types/logs.types';
import { cn } from '../utils/cn';
import { formatDateTimeYmd } from '../utils/format';
import { LoadingRegion } from './loading/loading-region';
import { TextLineSkeleton, UnifiedSkeleton } from './loading/unified-skeleton';
import { LogSeverityDot } from './log-severity-dot';
import { ToolIcon } from './tool-icon';

// UTC-pinned so the server and every client agree (React #418), through the one
// renderer rather than hand-built `getUTC*` strings.
const formatTimestamp = (timestamp: string | Date): string => formatDateTimeYmd(timestamp, null, { separator: ',' });

/** The log row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const LOG_ROW_CLASS = 'relative box-border flex w-full items-start gap-3 rounded px-1 py-2';
const LOG_ROW_TEXT_CLASS = 'min-w-0 flex-1 space-y-1';
const LOG_META_ROW_CLASS = 'flex items-center gap-2';
const LOG_SCROLL_CLASS = 'flex-1 overflow-y-auto px-4 py-3';
const LOG_FRAME_CLASS = 'relative flex flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-card';
/**
 * Rows the list's skeleton draws: one screen of the list's default 400px box (a row is a `text-h6` title over a
 * `text-h5` time, about 60px with its padding).
 */
const LOGS_LIST_FOLD = 6;

/** A log row while it is read: the severity dot's box, the title and the time as bars. */
function LogCardSkeleton() {
  return (
    <div className={LOG_ROW_CLASS} aria-hidden>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <UnifiedSkeleton variant="circular" className="h-3 w-3" />
      </span>
      <div className={LOG_ROW_TEXT_CLASS}>
        <TextLineSkeleton type="h6" className="w-3/4" />
        <div className={LOG_META_ROW_CLASS}>
          <TextLineSkeleton type="h5" className="w-32" />
        </div>
      </div>
    </div>
  );
}

const LogCard: FC<{
  log: LogEntry;
  isLast: boolean;
  showConnector: boolean;
  onClick?: () => void;
}> = ({ log, isLast, showConnector, onClick }) => {
  return (
    <div className="relative">
      <div
        className={cn(LOG_ROW_CLASS, 'cursor-pointer transition-colors hover:bg-ods-bg-hover/50')}
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

        <div className={LOG_ROW_TEXT_CLASS}>
          <p className="text-ods-text-primary text-h6">{log.title}</p>
          <div className={LOG_META_ROW_CLASS}>
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
      // The list's own frame and scroller with a screen of row skeletons.
      return (
        <div ref={ref} className={cn(LOG_FRAME_CLASS, getContainerClasses(), className)} style={getContainerStyles()}>
          <LoadingRegion label="Loading logs" className={LOG_SCROLL_CLASS}>
            {Array.from({ length: LOGS_LIST_FOLD }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows never reorder
              <LogCardSkeleton key={i} />
            ))}
          </LoadingRegion>
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
        className={cn(LOG_FRAME_CLASS, getContainerClasses(), className)}
        style={getContainerStyles()}
      >
        <div ref={containerRef} className={LOG_SCROLL_CLASS}>
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
