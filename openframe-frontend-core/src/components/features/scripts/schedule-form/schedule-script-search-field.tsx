'use client';

import type { FocusEvent } from 'react';
import { OS_PLATFORMS } from '../../../../utils/os-platforms';
import { Autocomplete } from '../../../ui/autocomplete';
import { Label } from '../../../ui/label';
import { TruncateText } from '../../../ui/truncate-text';

/** One script a search offers. */
export interface ScheduleScriptSearchResult {
  id: string;
  name: string;
  /** UI platform ids the script runs on — the icons beside its name. */
  supportedPlatforms: string[];
}

export interface ScheduleScriptSearchFieldProps {
  /** The card's script: `''` while nothing is picked. */
  scriptId: string;
  /** Its name — the label shown when the script is not on the current search page. */
  name: string;
  /** The current page of the host's search. */
  scripts: ScheduleScriptSearchResult[];
  isLoading?: boolean;
  /** What is typed in the field; decides which "nothing found" reading shows. */
  inputValue?: string;
  onInputChange?: (value: string) => void;
  /** Focus entered the field: a lazy search starts here. */
  onOpen?: () => void;
  /** Focus left the whole field. */
  onClose?: () => void;
  /** A script of `scripts` was picked (its id), or the field was cleared (null). */
  onChange: (scriptId: string | null) => void;
  disabled?: boolean;
  error?: string;
  invalid?: boolean;
}

function ScriptPlatformIcons({ platforms }: { platforms: string[] }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {OS_PLATFORMS.filter(p => platforms.includes(p.id)).map(p => (
        <p.icon key={p.id} className="h-3.5 w-3.5 text-ods-text-secondary opacity-60" />
      ))}
    </span>
  );
}

/**
 * "Select Script": the autocomplete of a schedule's script card. The search is
 * the host's (server-side, so the field does no filtering of its own); this is
 * the field every host draws around it.
 */
export function ScheduleScriptSearchField({
  scriptId,
  name,
  scripts,
  isLoading = false,
  inputValue = '',
  onInputChange,
  onOpen,
  onClose,
  onChange,
  disabled = false,
  error,
  invalid = false,
}: ScheduleScriptSearchFieldProps) {
  // Fires only when focus leaves the entire autocomplete widget (not on internal focus moves).
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) onClose?.();
  };

  // Every script stays offered in every card: the same script may legitimately
  // appear in a schedule more than once (the run order is the payload, so
  // "A, B, A" is a real recipe). Rows are keyed by the `useFieldArray` field id,
  // not by `scriptId`, so duplicates never collide in React or in dnd-kit.
  //
  // The selected script may not be in the current search page — prepend it so
  // the Autocomplete can always render its label (edit mode, stale searches).
  const options = scripts.map(s => ({ label: s.name, value: s.id }));
  if (scriptId && !options.some(o => o.value === scriptId)) {
    options.unshift({ label: name, value: scriptId });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]" onFocus={onOpen} onBlur={handleBlur}>
      <Label className="text-h4">Select Script</Label>
      <Autocomplete<string>
        options={options}
        value={scriptId || null}
        onChange={onChange}
        placeholder="Select a script..."
        disableClientFilter
        onInputChange={onInputChange}
        loading={isLoading}
        loadingText="Searching scripts..."
        noOptionsText={inputValue ? 'No scripts match your search' : 'No scripts available'}
        disabled={disabled}
        error={error}
        invalid={invalid}
        // Mirrors the Autocomplete's own option layout (flex row,
        // truncated label with a title) — overriding `renderOption`
        // opts out of it, which is what let long script names wrap.
        renderOption={(option, isSelected) => (
          <span className="flex w-full min-w-0 items-center gap-[var(--spacing-system-xsf)]">
            <span className="min-w-0 flex-1">
              <TruncateText className={isSelected ? 'text-ods-accent' : undefined}>{option.label}</TruncateText>
            </span>
            <ScriptPlatformIcons platforms={scripts.find(s => s.id === option.value)?.supportedPlatforms ?? []} />
          </span>
        )}
      />
    </div>
  );
}
