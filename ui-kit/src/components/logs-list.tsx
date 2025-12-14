import * as React from 'react'
import { cn } from '../utils/cn'
import { LogsListProps, LogEntry } from '../types/logs.types'
import { LogSeverityDot } from './log-severity-dot'
import { ToolIcon } from './tool-icon'

const formatTimestamp = (timestamp: string | Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
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
          'hover:bg-[#2a2a2a]/50 transition-colors cursor-pointer'
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
          <p className="font-['DM_Sans'] font-medium text-[14px] leading-5 text-white">
            {log.title}
          </p>
          <div className="flex items-center gap-2">
            <p className="font-['Azeret_Mono'] font-normal text-[13px] leading-4 text-[#888888] uppercase tracking-wider">
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
          className="absolute bg-[#3a3a3a] left-[15px] w-[2px]"
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
          'bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4',
          'flex items-center justify-center',
          getContainerClasses(),
          className
        )}
        style={getContainerStyles()}
      >
        <div className="text-[#666666] text-sm font-['DM_Sans']">Loading logs...</div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div 
        ref={ref}
        className={cn(
          'bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4',
          'flex items-center justify-center',
          getContainerClasses(),
          className
        )}
        style={getContainerStyles()}
      >
        <div className="text-[#666666] text-sm font-['DM_Sans']">{emptyMessage}</div>
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
        className="overflow-y-auto px-4 py-3 logs-list-scrollbar flex-1"
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