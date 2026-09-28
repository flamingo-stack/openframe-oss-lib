'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEndpointsRuntime } from '../contexts/endpoints-runtime-context';
import { contentFetch } from '../utils/embed-content-fetch';
import {
  captureFormRescueEvent,
  FORM_RESCUE_ATTEMPT_FIELD,
  FORM_RESCUE_DEBOUNCE_MS,
  FORM_RESCUE_EVENTS,
  FORM_RESCUE_RESUME_FIELD,
  FORM_RESCUE_RESUME_PARAM,
  filledRescueFields,
  isFormAttemptId,
  isRescueEmail,
  rescueCompletionPct,
  sanitizeRescueFieldName,
  sanitizeRescueValues,
  type FormDraftProgress,
  type FormDraftResumeResponse,
  type FormDraftSaveRequest,
  type FormRescueDefinition,
} from '../utils/form-rescue';

/** A local draft older than this is ignored and replaced. */
const LOCAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'form-rescue:v1:';
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;

interface LocalDraft {
  attemptId: string;
  values: Record<string, string>;
  savedAt: number;
}

export interface UseFormRescueOptions {
  /** Which form this is (`defineRescueForm`); `null` turns rescue off. */
  form: FormRescueDefinition | null;
  /** Every field the visitor can see. Hidden fields are never listed, so never sent. */
  fieldNames: readonly string[];
  /** Called once after mount with values from a resume link, else from this device's local draft. */
  onRestore?: (values: Record<string, string>) => void;
  /** The form's humanity signals, so the draft endpoint can run the same bot gate as the submit. */
  getSignals?: () => Record<string, string | number>;
}

export interface FormRescueHandle {
  /** Report the form's current values after a change (`lastField` = the field just edited). */
  track: (values: Record<string, unknown>, lastField?: string | null) => void;
  /** Keys to spread into the SUBMIT body so the host closes this attempt's draft. */
  submitFields: () => Record<string, string>;
  /** Call after a successful submit: clears the local draft and starts a fresh attempt. */
  complete: () => void;
}

function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // RFC 4122 v4 from getRandomValues for older browsers.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readLocalDraft(formId: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + formId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (!isFormAttemptId(parsed.attemptId) || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > LOCAL_DRAFT_TTL_MS) return null;
    return { attemptId: parsed.attemptId, values: sanitizeRescueValues(parsed.values), savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeLocalDraft(formId: string, draft: LocalDraft): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + formId, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the server draft still works.
  }
}

function clearLocalDraft(formId: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + formId);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Close a rescue attempt after a successful submit, for a form that has already
 * unmounted by then (the meeting scheduler's details-first flow): clears this
 * device's draft and reports the submit. The hook's `complete` calls it too.
 */
export function completeFormRescue(form: FormRescueDefinition | null, attemptId?: unknown): void {
  if (!form || typeof window === 'undefined') return;
  const local = readLocalDraft(form.id);
  captureFormRescueEvent(FORM_RESCUE_EVENTS.submitted, {
    form_id: form.id,
    attempt_id: isFormAttemptId(attemptId) ? attemptId : (local?.attemptId ?? null),
  });
  clearLocalDraft(form.id);
}

function readUtm(): FormDraftSaveRequest['utm'] {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: NonNullable<FormDraftSaveRequest['utm']> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(`utm_${key}`);
      if (value) utm[key] = value.slice(0, 200);
    }
    return Object.keys(utm).length ? utm : undefined;
  } catch {
    return undefined;
  }
}

/**
 * useFormRescue — saves a public form's progress so a visitor who leaves
 * before submitting can be followed up with, and restores it when they return.
 *
 * Every public lead form calls it the same way (next to `useHumanitySignals`):
 *
 *   const rescue = useFormRescue({ form: RESCUE_FORMS.waitlist, fieldNames, onRestore, getSignals })
 *   // on change: rescue.track(values, changedField)
 *   // submit:    body = { ...data, ...getSignals(), ...rescue.submitFields() }
 *   // success:   rescue.complete()
 *
 * Saves go to the host's `EndpointsRuntime.formDraftsUrl` (debounced, plus one
 * final keepalive save when the tab is hidden). A host that does not provide
 * the url gets the local draft only. Nothing here can block or delay a submit:
 * every network and storage call is fire-and-forget and swallows its errors.
 */
export function useFormRescue({ form, fieldNames, onRestore, getSignals }: UseFormRescueOptions): FormRescueHandle {
  const draftsUrl = useEndpointsRuntime()?.formDraftsUrl;
  const formId = form?.id ?? null;

  const attemptIdRef = useRef<string | null>(null);
  const resumeTokenRef = useRef<string | null>(null);
  const latestRef = useRef<FormDraftProgress | null>(null);
  const dirtyRef = useRef(false);
  const startedRef = useRef(false);
  const leadCapturedRef = useRef(false);
  const completedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callers pass inline arrays and callbacks; read them through refs so the
  // returned handle stays stable and effects run once. Written in an effect
  // (declared first, so it runs before the restore below), never during render.
  const fieldNamesRef = useRef(fieldNames);
  const onRestoreRef = useRef(onRestore);
  const getSignalsRef = useRef(getSignals);
  useEffect(() => {
    fieldNamesRef.current = fieldNames;
    onRestoreRef.current = onRestore;
    getSignalsRef.current = getSignals;
  });

  const attemptId = useCallback((): string => {
    if (!attemptIdRef.current) attemptIdRef.current = newAttemptId();
    return attemptIdRef.current;
  }, []);

  const send = useCallback(
    (keepalive: boolean) => {
      if (!formId || !draftsUrl || !dirtyRef.current || completedRef.current || !latestRef.current) return;
      dirtyRef.current = false;
      const body: FormDraftSaveRequest = {
        attempt_id: attemptId(),
        form_id: formId,
        ...latestRef.current,
        source_path: typeof window !== 'undefined' ? window.location.pathname : '/',
        utm: readUtm(),
        ...(resumeTokenRef.current ? { resume_token: resumeTokenRef.current } : {}),
      };
      try {
        void contentFetch(draftsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, ...(getSignalsRef.current?.() ?? {}) }),
          keepalive,
        }).catch(() => undefined);
      } catch {
        // A failed save is retried by the next change.
      }
      captureFormRescueEvent(FORM_RESCUE_EVENTS.progress, {
        form_id: formId,
        attempt_id: attemptId(),
        fields_filled: body.fields_filled,
        last_field: body.last_field,
        completion_pct: body.completion_pct,
      });
    },
    [attemptId, draftsUrl, formId],
  );

  // Restore once on mount: a resume link wins over this device's local draft.
  useEffect(() => {
    if (!formId || typeof window === 'undefined') return undefined;
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get(FORM_RESCUE_RESUME_PARAM);

    const restoreLocal = () => {
      const local = readLocalDraft(formId);
      if (!local) return;
      attemptIdRef.current = local.attemptId;
      if (Object.keys(local.values).length) onRestoreRef.current?.(local.values);
    };

    if (token && draftsUrl && /^[A-Za-z0-9_-]{16,128}$/.test(token)) {
      contentFetch(`${draftsUrl}/resume/${encodeURIComponent(token)}`)
        .then(async res => (res.ok ? ((await res.json()) as FormDraftResumeResponse) : null))
        .then(data => {
          if (cancelled) return;
          if (!data || data.form_id !== formId) {
            restoreLocal();
            return;
          }
          resumeTokenRef.current = token;
          onRestoreRef.current?.(sanitizeRescueValues(data.values));
          captureFormRescueEvent(FORM_RESCUE_EVENTS.resumed, { form_id: formId, attempt_id: attemptId() });
        })
        .catch(() => {
          if (!cancelled) restoreLocal();
        });
    } else {
      restoreLocal();
    }
    return () => {
      cancelled = true;
    };
  }, [attemptId, draftsUrl, formId]);

  // Final save when the visitor hides or leaves the tab.
  useEffect(() => {
    if (!formId || typeof document === 'undefined') return undefined;
    const onHide = () => {
      if (completedRef.current || !startedRef.current) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      send(true);
      captureFormRescueEvent(FORM_RESCUE_EVENTS.abandoned, {
        form_id: formId,
        attempt_id: attemptId(),
        last_field: latestRef.current?.last_field ?? null,
        completion_pct: latestRef.current?.completion_pct ?? 0,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [attemptId, formId, send]);

  const track = useCallback(
    (values: Record<string, unknown>, lastField?: string | null) => {
      if (!formId || completedRef.current) return;
      const names = fieldNamesRef.current;
      const visible: Record<string, unknown> = {};
      for (const name of names) visible[name] = values[name];
      const filled = filledRescueFields(visible, names);
      if (!filled.length) return;

      if (!startedRef.current) {
        startedRef.current = true;
        captureFormRescueEvent(FORM_RESCUE_EVENTS.started, { form_id: formId, attempt_id: attemptId() });
      }
      const clean = sanitizeRescueValues(visible);
      if (!leadCapturedRef.current && isRescueEmail(clean.email)) {
        leadCapturedRef.current = true;
        captureFormRescueEvent(FORM_RESCUE_EVENTS.leadCaptured, { form_id: formId, attempt_id: attemptId() });
      }
      latestRef.current = {
        values: clean,
        fields_filled: filled,
        last_field: sanitizeRescueFieldName(lastField),
        completion_pct: rescueCompletionPct(filled.length, names.length),
      };
      dirtyRef.current = true;
      writeLocalDraft(formId, { attemptId: attemptId(), values: clean, savedAt: Date.now() });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        send(false);
      }, FORM_RESCUE_DEBOUNCE_MS);
    },
    [attemptId, formId, send],
  );

  const submitFields = useCallback((): Record<string, string> => {
    if (!formId) return {};
    return {
      [FORM_RESCUE_ATTEMPT_FIELD]: attemptId(),
      ...(resumeTokenRef.current ? { [FORM_RESCUE_RESUME_FIELD]: resumeTokenRef.current } : {}),
    };
  }, [attemptId, formId]);

  const complete = useCallback(() => {
    if (!formId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    completeFormRescue(form, attemptId());
    // A fresh attempt for a second submission from the same page.
    attemptIdRef.current = null;
    resumeTokenRef.current = null;
    latestRef.current = null;
    dirtyRef.current = false;
    startedRef.current = false;
    leadCapturedRef.current = false;
  }, [attemptId, form, formId]);

  return useMemo(() => ({ track, submitFields, complete }), [track, submitFields, complete]);
}
