import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EndpointsRuntimeContext, type EndpointsRuntime } from '../../contexts/endpoints-runtime-context';
import { FORM_RESCUE_DEBOUNCE_MS, RESCUE_FORMS } from '../../utils/form-rescue';
import { useRescuedForm } from '../use-rescued-form';

/**
 * The generic react-hook-form adapter is what every rescued form uses, so its
 * contract is tested once here: edits are tracked (nested answers too), a
 * restored draft fills only EMPTY fields, and hidden fields are never sent.
 */

const runtime: EndpointsRuntime = {
  announcementsUrl: '/a',
  accessCode: { validateUrl: '/v', consumeUrl: '/c' },
  contactUrl: '/api/contact',
  formDraftsUrl: '/api/contact/drafts',
};

function wrapper({ children }: { children: ReactNode }) {
  return <EndpointsRuntimeContext.Provider value={runtime}>{children}</EndpointsRuntimeContext.Provider>;
}

interface Values {
  name: string;
  email: string;
  formFields: { company: string };
  secret: string;
}

function useFixture(defaults: Partial<Values> = {}) {
  const form = useForm<Values>({
    defaultValues: { name: '', email: '', formFields: { company: '' }, secret: 'hidden', ...defaults },
  });
  const rescue = useRescuedForm(form, {
    rescue: RESCUE_FORMS.meetingBooking,
    fields: ['name', 'email', 'company'],
    fieldPath: name => (name === 'company' ? 'formFields.company' : (name as 'name' | 'email')),
  });
  return { form, rescue };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response('{}', { status: 202 }))),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRescuedForm', () => {
  it('tracks edits, nested answers included, and never a hidden field', () => {
    const { result } = renderHook(() => useFixture(), { wrapper });
    act(() => {
      result.current.form.setValue('email', 'alex@northwind-it.com');
      result.current.form.setValue('formFields.company', 'Northwind IT');
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS);
    });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0][1]?.body)) as { values: Record<string, string>; form_id: string };
    expect(body.form_id).toBe('meeting_booking');
    expect(body.values).toEqual({ email: 'alex@northwind-it.com', company: 'Northwind IT' });
    expect(JSON.stringify(body)).not.toContain('hidden');
  });

  it('restores a local draft into empty fields only, at their real paths', () => {
    window.localStorage.setItem(
      'form-rescue:v1:meeting_booking',
      JSON.stringify({
        attemptId: '6f1c2a7e-3b9d-4e21-9a4f-0c8d5e7b1a22',
        values: { name: 'Alex', email: 'alex@northwind-it.com', company: 'Northwind IT' },
        savedAt: Date.now(),
      }),
    );
    const { result } = renderHook(() => useFixture({ name: 'Typed Already' }), { wrapper });
    expect(result.current.form.getValues('name')).toBe('Typed Already');
    expect(result.current.form.getValues('email')).toBe('alex@northwind-it.com');
    expect(result.current.form.getValues('formFields.company')).toBe('Northwind IT');
    expect(result.current.rescue.submitFields()).toEqual({ form_attempt_id: '6f1c2a7e-3b9d-4e21-9a4f-0c8d5e7b1a22' });
  });
});
