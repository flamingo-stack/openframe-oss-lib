import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { EndpointsRuntimeContext, type EndpointsRuntime } from '../../contexts/endpoints-runtime-context';
import { FORM_RESCUE_DEBOUNCE_MS } from '../../utils/form-rescue';
import { useFormRescue } from '../use-form-rescue';

/**
 * The hook's contract is a network and privacy contract, so it is asserted on
 * the fetch spy: one debounced save per burst of typing, only allowlisted
 * values in the body, no save before anything is filled, no analytics event
 * carrying a value, and a submit that closes the attempt it saved.
 */

const runtime: EndpointsRuntime = {
  announcementsUrl: '/api/announcements',
  accessCode: { validateUrl: '/v', consumeUrl: '/c' },
  contactUrl: '/api/contact',
  formDraftsUrl: '/api/contact/drafts',
};

function wrapper({ children }: { children: ReactNode }) {
  return <EndpointsRuntimeContext.Provider value={runtime}>{children}</EndpointsRuntimeContext.Provider>;
}

const FIELDS = ['name', 'email', 'message'] as const;

let fetchSpy: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
let captures: Array<{ event: string; props: Record<string, unknown> }>;

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  fetchSpy = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({ status: 'started' }), { status: 202 })),
  );
  vi.stubGlobal('fetch', fetchSpy);
  captures = [];
  (window as unknown as { posthog: unknown }).posthog = {
    capture: (event: string, props: Record<string, unknown>) => captures.push({ event, props }),
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as unknown as { posthog?: unknown }).posthog;
});

interface SentBody {
  attempt_id: string;
  [key: string]: unknown;
}

function sentBodies(): Array<{ url: string; body: SentBody }> {
  return fetchSpy.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) as SentBody }));
}

describe('useFormRescue', () => {
  it('debounces one save per burst with allowlisted values only', () => {
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS }), { wrapper });

    act(() => {
      result.current.track({ name: 'Al', email: '', message: '' }, 'name');
      result.current.track({ name: 'Alex', email: 'alex@northwind-it.com', message: 'secret text' }, 'message');
    });
    expect(sentBodies()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS);
    });
    const sent = sentBodies();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/contact/drafts');
    expect(sent[0].body.attempt_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0].body).toMatchObject({
      form_id: 'contact',
      values: { name: 'Alex', email: 'alex@northwind-it.com' },
      fields_filled: ['name', 'email', 'message'],
      last_field: 'message',
      completion_pct: 100,
    });
    expect(JSON.stringify(sent[0].body)).not.toContain('secret text');
  });

  it('sends nothing until a field is filled', () => {
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS }), { wrapper });
    act(() => {
      result.current.track({ name: '', email: '', message: '' }, 'name');
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS * 2);
    });
    expect(sentBodies()).toHaveLength(0);
  });

  it('never puts a field value into an analytics event', () => {
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS }), { wrapper });
    act(() => {
      result.current.track({ name: 'Alex', email: 'alex@northwind-it.com', message: '' }, 'email');
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS);
    });
    expect(captures.map(c => c.event)).toEqual(['form_started', 'form_lead_captured', 'form_progress']);
    const serialized = JSON.stringify(captures);
    expect(serialized).not.toContain('alex@northwind-it.com');
    expect(serialized).not.toContain('Alex"');
  });

  it('carries the saved attempt into the submit and starts a fresh one after', () => {
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS }), { wrapper });
    act(() => {
      result.current.track({ name: 'Alex', email: '', message: '' }, 'name');
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS);
    });
    const savedId = sentBodies()[0].body.attempt_id;
    expect(result.current.submitFields()).toEqual({ form_attempt_id: savedId });

    act(() => result.current.complete());
    expect(window.localStorage.getItem('form-rescue:v1:contact')).toBeNull();
    expect(result.current.submitFields().form_attempt_id).not.toBe(savedId);
  });

  it('restores this device’s draft and keeps its attempt', () => {
    window.localStorage.setItem(
      'form-rescue:v1:contact',
      JSON.stringify({
        attemptId: '6f1c2a7e-3b9d-4e21-9a4f-0c8d5e7b1a22',
        values: { email: 'alex@northwind-it.com', password: 'never' },
        savedAt: Date.now(),
      }),
    );
    const onRestore = vi.fn();
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS, onRestore }), {
      wrapper,
    });
    expect(onRestore).toHaveBeenCalledWith({ email: 'alex@northwind-it.com' });
    expect(result.current.submitFields()).toEqual({ form_attempt_id: '6f1c2a7e-3b9d-4e21-9a4f-0c8d5e7b1a22' });
  });

  it('prefills from a resume link and sends its token with the submit', async () => {
    vi.useRealTimers();
    // vitest.setup replaces `window.location` with a plain object; set its search directly.
    const location = window.location as unknown as { search: string; pathname: string };
    location.pathname = '/contact';
    location.search = '?resume=k3Xq9vT2mB7wYp1sLr8dQa';
    fetchSpy.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ form_id: 'contact', values: { email: 'alex@northwind-it.com' } }), {
          status: 200,
        }),
      ),
    );
    const onRestore = vi.fn();
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS, onRestore }), {
      wrapper,
    });
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith({ email: 'alex@northwind-it.com' }));
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/contact/drafts/resume/k3Xq9vT2mB7wYp1sLr8dQa');
    expect(result.current.submitFields()).toMatchObject({ form_resume_token: 'k3Xq9vT2mB7wYp1sLr8dQa' });
    expect(captures.map(c => c.event)).toContain('form_resumed');
    location.pathname = '/';
    location.search = '';
  });

  it('does nothing when rescue is off', () => {
    const { result } = renderHook(() => useFormRescue({ formId: null, fieldNames: FIELDS }), { wrapper });
    act(() => {
      result.current.track({ name: 'Alex', email: 'alex@northwind-it.com', message: '' }, 'name');
      vi.advanceTimersByTime(FORM_RESCUE_DEBOUNCE_MS);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.submitFields()).toEqual({});
  });

  it('saves once more with keepalive when the tab is hidden', () => {
    const { result } = renderHook(() => useFormRescue({ formId: 'contact', fieldNames: FIELDS }), { wrapper });
    act(() => {
      result.current.track({ name: 'Alex', email: '', message: '' }, 'name');
    });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    const puts = fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(puts).toHaveLength(1);
    expect(puts[0][1]?.keepalive).toBe(true);
    expect(captures.map(c => c.event)).toContain('form_abandoned');
  });
});
