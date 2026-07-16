import * as React from 'react'
import { cn } from '../utils/cn'
import { LogsListProps, LogEntry } from '../types/logs.types'
import { LogSeverityDot } from './log-severity-dot'
import { ToolIcon } from './tool-icon'

const formatTimestamp = (timestamp: string | Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  
  // UTC getters so the timestamp is identical on server (UTC) and client
  // (local) — otherwise React #418 hydration mismatch.
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')

  return `${year}/${month}/${day},${hours}:${minutes}`
}

const LogCard: React.FC<{
  log: LogEntry
  isLast: boolean
  showConnector: boolean
  onClick?: () => void
}> = ({ log, isLast, showConnector, onClick }) => {
  return (
    <div className="relative">
      <div
        className={cn(
          'box-border flex gap-3 items-start py-2 px-1 relative rounded w-full',
          'hover:bg-ods-bg-hover/50 transition-colors cursor-pointer'
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }}
      >
        <LogSeverityDot severity={log.severity} size="md" />
        
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-h6 text-ods-text-primary">
            {log.title}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-h5 text-ods-text-secondary">
              {formatTimestamp(log.timestamp)}
            </p>
            {log.toolType && (
              <ToolIcon toolType={log.toolType} size={16} />
            )}
          </div>
        </div>
      </div>
      
      {showConnector && !isLast && (
        <div 
          className="absolute bg-ods-border left-[15px] w-[2px]"
          style={{ 
            top: '28px',
            bottom: '-10px'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export const LogsList = React.forwardRef<
  HTMLDivElement,
  LogsListProps
>(({ 
  logs, 
  maxHeight = '400px', 
  showConnector = true,
  onLogClick,
  loading = false,
  emptyMessage = 'No logs to display',
  className 
}, ref) => {
  const containerRef = React.useRef<HTMLDivElement>(null)

  const isFullHeight = maxHeight === '100%'

  const getContainerStyles = () => {
    if (isFullHeight) return undefined
    return { maxHeight, minHeight: '200px' }
  }

  const getContainerClasses = () => {
    if (isFullHeight) return 'h-full'
    return ''
  }

  if (loading) {
    return (
      <div 
        ref={ref}
        className={cn(
          'bg-ods-card border border-ods-border rounded-lg p-4',
          'flex items-center justify-center',
          getContainerClasses(),
          className
        )}
        style={getContainerStyles()}
      >
        <div className="text-ods-text-muted text-h6">Loading logs...</div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div 
        ref={ref}
        className={cn(
          'bg-ods-card border border-ods-border rounded-lg p-4',
          'flex items-center justify-center',
          getContainerClasses(),
          className
        )}
        style={getContainerStyles()}
      >
        <div className="text-ods-text-muted text-h6">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        'bg-ods-card border border-ods-border rounded-lg relative',
        'flex flex-col overflow-hidden',
        getContainerClasses(),
        className
      )}
      style={getContainerStyles()}
    >
      <div
        ref={containerRef}
        className="overflow-y-auto px-4 py-3 flex-1"
      >
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
  )
})

LogsList.displayName = 'LogsList'