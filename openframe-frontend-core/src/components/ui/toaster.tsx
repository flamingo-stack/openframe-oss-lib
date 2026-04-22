'use client'

import * as React from 'react'
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import type { ExternalToast } from 'sonner'
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ToolIcon } from '../tool-icon'
import type { ToolType } from '../../types/tool.types'
import { cn } from '../../utils/cn'

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const dotColorByVariant: Record<ToastVariant, string> = {
  default: 'bg-ods-text-secondary',
  success: 'bg-ods-success',
  warning: 'bg-ods-warning',
  error: 'bg-ods-error',
  info: 'bg-ods-info',
}

const progressColorByVariant: Record<ToastVariant, string> = {
  default: 'bg-ods-text-secondary',
  success: 'bg-ods-success',
  warning: 'bg-ods-accent',
  error: 'bg-ods-error',
  info: 'bg-ods-info',
}

interface ToastHeaderProps {
  id: string | number
  variant: ToastVariant
  title?: React.ReactNode
  description?: React.ReactNode
  duration?: number
  dismissible?: boolean
  className?: string
  showProgress?: boolean
}

function ToastHeader({
  id,
  variant,
  title,
  description,
  duration = 4000,
  dismissible = true,
  className,
  showProgress = true,
}: ToastHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex w-full items-start gap-2 overflow-hidden bg-ods-card p-3',
        className,
      )}
    >
      <div className="flex size-6 shrink-0 items-center justify-center">
        <span className={cn('size-[9px] rounded-full', dotColorByVariant[variant])} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center font-['DM_Sans'] font-medium">
        {title ? (
          <p className="truncate pr-5 text-[18px] leading-6 text-ods-text-primary">{title}</p>
        ) : null}
        {description ? (
          <p className="text-[14px] leading-5 text-ods-text-secondary line-clamp-3">{description}</p>
        ) : null}
      </div>

      {dismissible ? (
        <button
          type="button"
          aria-label="Close"
          onClick={() => sonnerToast.dismiss(id)}
          className="absolute right-[7px] top-[7px] flex size-4 items-center justify-center text-ods-text-secondary transition-colors hover:text-ods-text-primary"
        >
          <XmarkIcon size={16} />
        </button>
      ) : null}

      {showProgress && duration !== Infinity && duration > 0 ? (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 h-1 origin-left',
            progressColorByVariant[variant],
          )}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      ) : null}
    </div>
  )
}

export interface ToastCardProps {
  id: string | number
  variant?: ToastVariant
  title?: React.ReactNode
  description?: React.ReactNode
  duration?: number
  dismissible?: boolean
  className?: string
}

export function ToastCard({
  id,
  variant = 'default',
  title,
  description,
  duration = 4000,
  dismissible = true,
  className,
}: ToastCardProps) {
  return (
    <div
      role="status"
      className={cn(
        'w-[368px] max-w-[calc(100vw-32px)] overflow-hidden rounded-md border border-ods-border bg-ods-card shadow-lg',
        className,
      )}
    >
      <ToastHeader
        id={id}
        variant={variant}
        title={title}
        description={description}
        duration={duration}
        dismissible={dismissible}
      />
    </div>
  )
}

export interface CommandApprovalToastProps {
  id: string | number
  variant?: ToastVariant
  title?: React.ReactNode
  description?: React.ReactNode
  command: string
  toolType?: ToolType
  approvalDescription?: React.ReactNode
  approveLabel?: string
  rejectLabel?: string
  onApprove?: () => void
  onReject?: () => void
  duration?: number
  dismissible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export function CommandApprovalToast({
  id,
  variant = 'warning',
  title = 'Tech Required',
  description = 'Approval is required to execute the command.',
  command,
  toolType,
  approvalDescription,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  onApprove,
  onReject,
  duration = Infinity,
  dismissible = true,
  defaultExpanded = false,
  className,
}: CommandApprovalToastProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)

  const handleApprove = () => {
    onApprove?.()
    sonnerToast.dismiss(id)
  }

  const handleReject = () => {
    onReject?.()
    sonnerToast.dismiss(id)
  }

  return (
    <div
      role="status"
      className={cn(
        'flex w-[368px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg shadow-lg',
        className,
      )}
    >
      <ToastHeader
        id={id}
        variant={variant}
        title={title}
        description={description}
        duration={duration}
        dismissible={dismissible}
        showProgress={!expanded}
        className="border-b border-ods-border"
      />

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          <div className="flex h-11 w-full items-center gap-2 border-b border-ods-border bg-ods-card px-3 py-2">
            <p className="min-w-0 flex-1 truncate font-['DM_Sans'] text-[14px] font-medium leading-5 text-ods-text-primary">
              {command}
            </p>
            {toolType ? <ToolIcon toolType={toolType} size={16} /> : null}
          </div>

          <div className="flex flex-col gap-2 bg-ods-bg p-3">
            {approvalDescription ? (
              <p className="font-['DM_Sans'] text-[14px] font-medium leading-5 text-ods-text-secondary">
                {approvalDescription}
              </p>
            ) : null}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleApprove}
                tabIndex={expanded ? 0 : -1}
                className="flex flex-1 items-center justify-center rounded-md bg-ods-accent px-2 py-2 font-['Azeret_Mono'] text-[14px] font-medium uppercase tracking-[-0.28px] text-ods-text-on-accent transition-colors hover:bg-ods-accent-hover active:bg-ods-accent-active"
              >
                {approveLabel}
              </button>
              <button
                type="button"
                onClick={handleReject}
                tabIndex={expanded ? 0 : -1}
                className="flex flex-1 items-center justify-center rounded-md border border-ods-border bg-ods-card px-2 py-2 font-['Azeret_Mono'] text-[14px] font-medium uppercase tracking-[-0.28px] text-ods-text-primary transition-colors hover:bg-ods-bg-hover"
              >
                {rejectLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded ? null : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 bg-ods-card px-3 py-2 text-left font-['DM_Sans'] text-[14px] font-medium leading-5 text-ods-text-primary transition-colors hover:bg-ods-bg-hover"
          aria-expanded={false}
        >
          <span className="flex-1">Show Command</span>
          <Chevron02DownIcon size={16} />
        </button>
      )}
    </div>
  )
}

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>

export function Toaster({
  position = 'bottom-right',
  offset = 24,
  gap = 8,
  toastOptions,
  ...rest
}: ToasterProps = {}) {
  const { classNames: userClassNames, ...restToastOptions } = toastOptions ?? {}

  return (
    <>
      <style>{`
        @keyframes toast-progress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <SonnerToaster
        position={position}
        offset={offset}
        gap={gap}
        toastOptions={{
          unstyled: true,
          ...restToastOptions,
          classNames: {
            toast: 'w-full',
            ...userClassNames,
          },
        }}
        {...rest}
      />
    </>
  )
}

export interface ShowToastOptions extends Omit<ExternalToast, 'description'> {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
}

export function showToast(options: ShowToastOptions | string) {
  const opts: ShowToastOptions =
    typeof options === 'string' ? { title: options } : options

  const {
    title,
    description,
    variant = 'default',
    duration = 4000,
    dismissible = true,
    ...rest
  } = opts

  return sonnerToast.custom(
    (id) => (
      <ToastCard
        id={id}
        variant={variant}
        title={title}
        description={description}
        duration={duration}
        dismissible={dismissible}
      />
    ),
    { duration, dismissible, ...rest },
  )
}

export interface ShowCommandApprovalToastOptions
  extends Omit<ExternalToast, 'description'>,
    Omit<CommandApprovalToastProps, 'id'> {}

export function showCommandApprovalToast(options: ShowCommandApprovalToastOptions) {
  const {
    variant,
    title,
    description,
    command,
    toolType,
    approvalDescription,
    approveLabel,
    rejectLabel,
    onApprove,
    onReject,
    defaultExpanded,
    duration = Infinity,
    dismissible = true,
    ...rest
  } = options

  return sonnerToast.custom(
    (id) => (
      <CommandApprovalToast
        id={id}
        variant={variant}
        title={title}
        description={description}
        command={command}
        toolType={toolType}
        approvalDescription={approvalDescription}
        approveLabel={approveLabel}
        rejectLabel={rejectLabel}
        onApprove={onApprove}
        onReject={onReject}
        defaultExpanded={defaultExpanded}
        duration={duration}
        dismissible={dismissible}
      />
    ),
    { duration, dismissible, ...rest },
  )
}
