'use client';

import { forwardRef, useMemo, useState } from 'react';

import { cn } from '../../utils/cn';
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon } from '../icons-v2-generated';
import type { ToolType } from '../platform';
import { ToolIcon } from '../tool-icon';
import { ExpandChevron } from './expand-chevron';
import { useCollapsible } from './hooks/use-collapsible';
import { ArgRow, ResultBlock } from './tool-call-blocks';
import type { ToolExecutionDisplayProps } from './types';
import { COMMAND_BODY_ARG_KEYS } from './utils/tool-call-helpers';

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS);

const ToolExecutionDisplay = forwardRef<HTMLDivElement, ToolExecutionDisplayProps>(
  ({ className, message, assistantType, variant = 'admin', ...props }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const { innerRef, containerStyle } = useCollapsible({ expanded });
    const isClient = assistantType === 'fae';
    // Render audience (consumer-declared, NOT `assistantType`). The end-client
    // Fae app (`'client'`) gets a static, non-expandable row — just the
    // explanation + status; the command/args/result are admin-only detail the
    // end user doesn't need. Every admin surface keeps the expandable accordion.
    const isClientView = variant === 'client';

    const isExecuting = message.type === 'EXECUTING_TOOL';
    const isExecuted = message.type === 'EXECUTED_TOOL';
    const integratedToolType = (message.integratedToolType as ToolType) || 'OPENFRAME';

    // Header text depends on the render audience (the consumer-declared
    // `variant`, NOT `assistantType`: a ticket's Fae client tab on the admin
    // dashboard is still `assistantType === 'fae'`). The end-client Fae app
    // (`variant === 'client'`) reads the human-readable explanation (what/why);
    // every admin surface reads the concise BE-provided title. Each falls back
    // to the other when its preferred field is absent (older backends /
    // EXECUTED rows).
    const previewText = variant === 'client' ? message.toolExplanation?.trim() : message.toolTitle?.trim();

    const argEntries = useMemo<Array<[string, unknown]>>(() => {
      if (!message.parameters || typeof message.parameters !== 'object') return [];
      const entries = Object.entries(message.parameters).filter(([, v]) => v !== null && v !== undefined && v !== '');
      // The end client (Fae app) never sees the raw command/query/script body —
      // only the secondary args. Every admin surface DOES: surface the command
      // body first (as a labeled `command:` row), then the rest of the args.
      if (variant === 'client') {
        return entries.filter(([k]) => !COMMAND_BODY_KEYS.has(k));
      }
      const commandEntries = entries.filter(([k]) => COMMAND_BODY_KEYS.has(k));
      const otherEntries = entries.filter(([k]) => !COMMAND_BODY_KEYS.has(k));
      return [...commandEntries, ...otherEntries];
    }, [message.parameters, variant]);

    const hasResult = isExecuted && typeof message.result === 'string' && message.result.length > 0;
    const hasBody = argEntries.length > 0 || hasResult || isExecuting;
    const isConciseRemoteRead =
      !message.integratedToolType && !!message.toolTitle?.trim() && argEntries.length === 0 && !hasResult;
    const isStaticRow = isClientView || isConciseRemoteRead;

    const renderStatusIcon = () => {
      if (isExecuting) return <DotsLoaderIcon size={16} className="text-ods-text-secondary" />;
      if (isExecuted && message.success === true) return <CheckCircleIcon className="h-4 w-4 text-ods-success" />;
      if (isExecuted && message.success === false) return <XmarkCircleIcon className="h-4 w-4 text-ods-error" />;
      return null;
    };

    const headerContent = (
      <>
        {!isClient && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ToolIcon toolType={integratedToolType} size={16} />
          </div>
        )}
        <div
          className={cn(
            'min-w-0 flex-1 text-h6',
            isClientView
              ? 'whitespace-pre-wrap break-words text-ods-text-primary'
              : expanded
                ? 'whitespace-pre-wrap break-all text-ods-text-primary'
                : 'line-clamp-2 max-h-10 break-all text-ods-text-secondary',
          )}
        >
          {previewText}
        </div>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">{renderStatusIcon()}</div>
        {!isStaticRow && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ExpandChevron expanded={expanded} />
          </div>
        )}
      </>
    );

    return (
      <div
        ref={ref}
        className={cn(
          // The command running block keeps its bordered box in both chats
          // (Figma 1972-6109). CLIENT (Fae) only drops the tool icon below.
          'flex w-full flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
          className,
        )}
        {...props}
      >
        {isStaticRow ? (
          // Client (Fae end-user): static, non-expandable row — no chevron, no
          // body. Just the explanation + status; command/args/result are hidden.
          <div className="flex w-full items-start gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)] text-left">
            {headerContent}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex w-full cursor-pointer items-start gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)] text-left"
              onClick={() => setExpanded(prev => !prev)}
            >
              {headerContent}
            </button>

            <div className="w-full" style={containerStyle}>
              <div ref={innerRef}>
                {hasBody && (
                  <div className="flex w-full flex-col items-start gap-0 bg-ods-card p-[var(--spacing-system-sf)] text-h6">
                    {argEntries.map(([key, value]) => (
                      <ArgRow key={key} argKey={key} value={value} />
                    ))}
                    {hasResult && (
                      <ResultBlock
                        result={message.result}
                        className={argEntries.length > 0 ? 'mt-[var(--spacing-system-xsf)]' : undefined}
                      />
                    )}
                    {isExecuting && (
                      <div
                        className={cn(
                          'flex w-full flex-col items-start gap-[var(--spacing-system-xxs)]',
                          argEntries.length > 0 && 'mt-[var(--spacing-system-xsf)]',
                        )}
                      >
                        <span className="text-ods-text-secondary">Result:</span>
                        <DotsLoaderIcon size={16} className="text-ods-text-secondary" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

ToolExecutionDisplay.displayName = 'ToolExecutionDisplay';

export { ToolExecutionDisplay };
