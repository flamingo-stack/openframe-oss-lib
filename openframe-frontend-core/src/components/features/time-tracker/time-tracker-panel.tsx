'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../../utils/cn'
import { Autocomplete, type AutocompleteOption } from '../../ui/autocomplete'
import { Button } from '../../ui/button/button'
import { SplitButton } from '../../ui/button/split-button'
import { SquareAvatar } from '../../ui/square-avatar'
import { Tag } from '../../ui/tag'
import { Textarea } from '../../ui/textarea'
import {
  ArrowRightUpIcon,
  CheckCircleIcon,
  CheckIcon,
  Chevron02RightIcon,
  ClockHistoryIcon,
  DotsLoaderIcon,
  PauseIcon,
  PlayIcon,
  PlusCircleIcon,
  XmarkIcon,
} from '../../icons-v2-generated'
import { useTrackerClock } from './use-tracker-clock'
import type { TimeTrackerData, TimeTrackerEntry, TimeTrackerStatus } from './types'

interface CustomerAutocompleteOption extends AutocompleteOption {
  imageUrl?: string
}

function renderCustomerOption(option: AutocompleteOption, isSelected: boolean) {
  const { label, imageUrl } = option as CustomerAutocompleteOption
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        <SquareAvatar src={imageUrl} alt={label} fallback={label} size="sm" variant="square" />
        <span className="truncate" title={label}>
          {label}
        </span>
      </div>
      {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
    </div>
  )
}

export interface TimeTrackerPanelProps extends TimeTrackerData {
  onClose: () => void
  className?: string
}

export function TimeTrackerPanel({
  status,
  runningSince,
  accumulatedMs,
  ticketOptions,
  selectedTicketId,
  onSelectedTicketChange,
  onTicketSearch,
  ticketsLoading,
  customerOptions,
  selectedCustomerId,
  onSelectedCustomerChange,
  onCustomerSearch,
  customersLoading,
  customerLocked,
  notes,
  onNotesChange,
  lastEntries,
  onStart,
  onPause,
  onResume,
  onCancel,
  onSubmit,
  onManualEntry,
  onOpenMyTime,
  onOpenMyTimeMenu,
  onEntryClick,
  isStarting,
  isSubmitting,
  onClose,
  className,
}: TimeTrackerPanelProps) {
  const elapsedLabel = useTrackerClock({ status, runningSince, accumulatedMs })

  const [showValidationError, setShowValidationError] = useState(false)

  const isRunning = status === 'tracking'
  const isActive = status !== 'ready'
  const hasContent = selectedTicketId != null || notes.trim() !== ''
  const showFieldError = isActive && showValidationError && !hasContent

  // Reset the validation flag once a session ends so the next one starts clean.
  useEffect(() => {
    if (status === 'ready') setShowValidationError(false)
  }, [status])

  const handleSubmit = () => {
    if (!hasContent) {
      setShowValidationError(true)
      return
    }
    onSubmit()
  }

  const handleManualEntry = onManualEntry
    ? () => {
        onClose()
        onManualEntry()
      }
    : undefined
  const handleEntryClick = onEntryClick
    ? (entry: TimeTrackerEntry) => {
        onClose()
        onEntryClick(entry)
      }
    : undefined
  const handleOpenMyTime = onOpenMyTime
    ? () => {
        onClose()
        onOpenMyTime()
      }
    : undefined
  const handleCancel = () => {
    onClose()
    onCancel()
  }

  const ticketAutocompleteOptions: AutocompleteOption[] = ticketOptions.map((t) => ({
    label: t.label,
    value: t.id,
  }))

  const showCustomer = !!onSelectedCustomerChange
  const customerAutocompleteOptions: CustomerAutocompleteOption[] = (customerOptions ?? []).map((c) => ({
    label: c.label,
    value: c.id,
    imageUrl: c.imageUrl,
  }))
  const selectedCustomer = customerAutocompleteOptions.find((o) => o.value === selectedCustomerId)
  const customerStartAdornment = selectedCustomer ? (
    <SquareAvatar
      src={selectedCustomer.imageUrl}
      alt={selectedCustomer.label}
      fallback={selectedCustomer.label}
      size="sm"
      variant="square"
    />
  ) : undefined

  const visibleEntries = lastEntries.slice(0, 3)

  return (
    <div
      className={cn(
        'relative flex max-h-[calc(100vh-6rem)] w-full flex-col gap-[var(--spacing-system-l)] overflow-y-auto rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]',
        className,
      )}
    >
      <Button
        variant="transparent"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close time tracker"
        className="absolute right-[var(--spacing-system-sf)] top-[var(--spacing-system-sf)] hidden text-ods-text-secondary hover:text-ods-text-primary md:inline-flex [&_svg]:!size-6"
      >
        <XmarkIcon />
      </Button>

      {/* Status + timer + ticket assignment */}
      <div className="flex flex-col gap-[var(--spacing-system-m)]">
        <div className="flex items-center gap-[var(--spacing-system-s)]">
          <StatusTag status={status} />
          {isActive && (
            <Button
              variant="transparent"
              onClick={handleCancel}
              className="h-auto p-0 text-h6 font-medium text-ods-text-secondary underline hover:bg-transparent hover:text-ods-text-primary md:h-auto"
            >
              Cancel Entry
            </Button>
          )}
        </div>

        <div className="flex items-stretch overflow-hidden rounded-md border border-ods-border">
          <div className="flex flex-1 items-center border-r border-ods-border bg-ods-bg px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]">
            <span
              className={cn(
                'text-h3 !font-mono font-bold tabular-nums',
                isActive ? 'text-ods-text-primary' : 'text-ods-text-secondary',
              )}
            >
              {elapsedLabel}
            </span>
          </div>

          <Button
            size="icon"
            variant={isActive ? 'transparent' : 'accent'}
            onClick={status === 'tracking' ? onPause : status === 'paused' ? onResume : onStart}
            disabled={isStarting}
            aria-label={isRunning ? 'Pause tracking' : isActive ? 'Resume tracking' : 'Start tracking'}
            className="h-auto w-auto rounded-none transition-none [&_svg]:!size-6"
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </Button>

          {isActive && (
            <Button
              size="icon"
              variant="accent"
              onClick={handleSubmit}
              disabled={isSubmitting}
              aria-label="Finish and save tracking"
              className="h-auto w-auto rounded-none border-l border-ods-border [&_svg]:!size-6"
            >
              <CheckCircleIcon />
            </Button>
          )}
        </div>

        <div className={cn('grid gap-[var(--spacing-system-m)]', showCustomer && 'grid-cols-2')}>
          <Autocomplete
            value={selectedTicketId}
            onChange={onSelectedTicketChange}
            options={ticketAutocompleteOptions}
            placeholder="Select Ticket"
            loading={ticketsLoading}
            invalid={showFieldError}
            error={showFieldError ? 'Required if no notes added' : undefined}
            disableClientFilter={!!onTicketSearch}
            onInputChange={(value, reason) => {
              if (reason === 'input') onTicketSearch?.(value)
            }}
          />
          {showCustomer && (
            <Autocomplete
              value={selectedCustomerId ?? null}
              onChange={onSelectedCustomerChange}
              options={customerAutocompleteOptions}
              placeholder="Select Customer"
              loading={customersLoading}
              disabled={customerLocked}
              disableClientFilter={!!onCustomerSearch}
              onInputChange={(value, reason) => {
                if (reason === 'input') onCustomerSearch?.(value)
              }}
              startAdornment={customerStartAdornment}
              renderOption={renderCustomerOption}
            />
          )}
        </div>
      </div>

      <Textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        invalid={showFieldError}
        error={showFieldError ? 'Required if no ticket assigned' : undefined}
        placeholder="Additional Notes (optional if ticket selected)"
        className="max-h-[280px]"
      />

      {/* Last entries + footer */}
      <div className="flex flex-col gap-[var(--spacing-system-m)]">
        {visibleEntries.length === 0 ? (
          <div className="flex min-h-[268px] flex-col items-center justify-center gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)] text-center text-ods-text-secondary">
            <ClockHistoryIcon className="size-6" />
            <div className="flex flex-col">
              <p className="text-h4 font-medium">No time logged</p>
              <p className="text-h6">Last entries will appear here</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--spacing-system-xs)]">
            <p className="font-mono text-h6 uppercase tracking-wide text-ods-text-secondary">Last Entries</p>
            <div className="overflow-hidden rounded-md border border-ods-border bg-ods-card">
              {visibleEntries.map((entry) => (
                <LastEntryRow key={entry.id} entry={entry} onClick={handleEntryClick} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-[var(--spacing-system-m)]">
          <Button
            variant="outline"
            className="min-w-0"
            onClick={handleManualEntry}
            disabled={!onManualEntry}
            leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
          >
            Manual Entry
          </Button>
          <SplitButton
            variant="outline"
            fullWidth
            className="min-w-0"
            onClick={handleOpenMyTime}
            disabled={!onOpenMyTime && !onOpenMyTimeMenu}
            mainDisabled={!onOpenMyTime}
            groupAriaLabel="Open my time"
            iconAction={{
              icon: <ArrowRightUpIcon size={24} />,
              'aria-label': 'Open my time in a new view',
              onClick: onOpenMyTimeMenu,
              disabled: !onOpenMyTimeMenu,
              openInNewTab: true,
            }}
          >
            Open My Time
          </SplitButton>
        </div>
      </div>

      <Button variant="outline" fullWidth onClick={onClose} className="md:hidden">
        Close
      </Button>
    </div>
  )
}

const STATUS_TAG_SKIN = 'gap-[var(--spacing-system-xs)] font-mono font-medium uppercase tracking-tight'

function StatusTag({ status }: { status: TimeTrackerStatus }) {
  if (status === 'tracking') {
    return (
      <Tag variant="success" className={STATUS_TAG_SKIN} icon={<DotsLoaderIcon className="h-4 w-4" />} label="Tracking" />
    )
  }
  if (status === 'paused') {
    return <Tag variant="warning" className={STATUS_TAG_SKIN} icon={<PauseIcon className="h-4 w-4" />} label="Paused" />
  }
  return <Tag variant="grey" className={STATUS_TAG_SKIN} label="Ready to Track" />
}

interface LastEntryRowProps {
  entry: TimeTrackerEntry
  onClick?: (entry: TimeTrackerEntry) => void
}

function LastEntryRow({ entry, onClick }: LastEntryRowProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] border-b border-ods-border bg-ods-bg px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] last:border-b-0">
      <div className="flex w-[88px] shrink-0 flex-col justify-center">
        <span className="truncate text-h4 font-medium text-ods-text-primary">{entry.durationLabel}</span>
        <span className="truncate text-h6 text-ods-text-secondary">{entry.dateLabel}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-h4 font-medium text-ods-text-primary">{entry.title}</span>
        {entry.description && (
          <span className="truncate text-h6 text-ods-text-secondary">{entry.description}</span>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onClick?.(entry)}
        disabled={!onClick}
        aria-label={`Open entry: ${entry.title}`}
        className="h-12 w-12 shrink-0 [&_svg]:!size-6"
      >
        <Chevron02RightIcon />
      </Button>
    </div>
  )
}
