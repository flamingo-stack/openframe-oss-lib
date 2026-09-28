'use client';

import { useEffect } from 'react';
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import type { FormRescueDefinition } from '../utils/form-rescue';
import { useFormRescue, type FormRescueHandle } from './use-form-rescue';

export interface UseRescuedFormOptions<T extends FieldValues> {
  /** The form's definition (`defineRescueForm` / `RESCUE_FORMS`); `null` turns rescue off. */
  rescue: FormRescueDefinition | null;
  /** The fields the visitor can see, by the name a draft stores them under. Hidden fields are never listed. */
  fields: readonly string[];
  /** The form's humanity signals, so draft saves pass the same bot gate as the submit. */
  getSignals?: () => Record<string, string | number>;
  /** Where a stored field lives in the form, when it is nested (`company` → `formFields.company`). Default: the same name. */
  fieldPath?: (name: string) => Path<T>;
}

/** One level of nesting flattened (`{ formFields: { company } }` → `{ company }`), so nested answers read like top-level ones. */
function flattenOneLevel(values: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(flat, value);
    else flat[key] = value;
  }
  return flat;
}

/**
 * useRescuedForm — form rescue for ANY react-hook-form form, in one call.
 *
 * Wires what every rescued form needs so no form hand-rolls it: every edit is
 * tracked (`watch`), a resume link or this device's draft fills the empty
 * fields (`setValue`), and the handle's `submitFields()` / `complete()` close
 * the attempt on submit. A form that is not react-hook-form uses
 * `useFormRescue` directly.
 *
 *   const rescue = useRescuedForm(form, { rescue: RESCUE_FORMS.contact, fields, getSignals })
 *   // submit:  body = { ...data, ...getSignals(), ...rescue.submitFields() }
 *   // success: rescue.complete()
 */
export function useRescuedForm<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'watch' | 'getValues' | 'setValue'>,
  { rescue, fields, getSignals, fieldPath }: UseRescuedFormOptions<T>,
): FormRescueHandle {
  const { watch, getValues, setValue } = form;

  const handle = useFormRescue({
    form: rescue,
    fieldNames: fields,
    getSignals,
    onRestore: values => {
      for (const name of fields) {
        const value = values[name];
        if (!value) continue;
        const path = fieldPath ? fieldPath(name) : (name as Path<T>);
        // Only an empty field is filled: never overwrite what the visitor typed.
        if (!getValues(path)) setValue(path, value as PathValue<T, Path<T>>, { shouldDirty: true });
      }
    },
  });

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      handle.track(flattenOneLevel(values), name ? (name.split('.').pop() ?? null) : null);
    });
    return () => subscription.unsubscribe();
  }, [watch, handle]);

  return handle;
}
