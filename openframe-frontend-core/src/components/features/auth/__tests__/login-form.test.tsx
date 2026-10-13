import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from '../login-form';
import type { AuthSsoProvider } from '../sso-providers';

const baseProps = { email: '', onEmailChange: () => {}, ssoProviders: [] as AuthSsoProvider[] };

/**
 * The login card has no consent checkbox, so the legal row is the only place its Terms and Privacy
 * links live — and it is opt-in, because consumers outside OpenFrame have no urls to give it.
 */
describe('LoginForm legal links', () => {
  it('renders Terms of Service and Privacy Policy as new-tab links when both urls are given', () => {
    render(
      <LoginForm {...baseProps} termsUrl="https://example.com/terms" privacyPolicyUrl="https://example.com/privacy" />,
    );
    const terms = screen.getByRole('link', { name: 'Terms of Service' });
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(terms.getAttribute('href')).toBe('https://example.com/terms');
    expect(privacy.getAttribute('href')).toBe('https://example.com/privacy');
    expect(terms.getAttribute('target')).toBe('_blank');
    expect(privacy.getAttribute('target')).toBe('_blank');
  });

  it('renders no legal row when the urls are omitted', () => {
    render(<LoginForm {...baseProps} />);
    expect(screen.queryByRole('link', { name: 'Terms of Service' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).toBeNull();
  });
});

const GENERIC: AuthSsoProvider[] = ['google', 'microsoft', 'apple'];

const buttonNames = () => screen.getAllByRole('button').map(button => button.textContent);

/** Whether `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/**
 * Email first, methods under it: once an email resolves an organization, its own methods take the
 * place of the generic block, headed by its name, so the same-looking button never silently starts
 * signing in through a different identity provider.
 */
describe('LoginForm sign-in methods', () => {
  it('renders the generic providers under the email field before an organization is known', () => {
    render(<LoginForm {...baseProps} ssoProviders={GENERIC} />);
    const field = screen.getByRole('textbox');
    const google = screen.getByRole('button', { name: /Continue with Google/ });
    expect(precedes(field, google)).toBe(true);
    expect(screen.getByText('or continue with')).toBeTruthy();
    expect(screen.queryByText(/Sign-in methods for/)).toBeNull();
  });

  it("shows only the organization's own methods, OpenFrame first and its providers tagged with its name", () => {
    render(
      <LoginForm
        {...baseProps}
        ssoProviders={[]}
        tenantMethods={{ name: 'Acme', providers: ['microsoft', 'openframe'] }}
      />,
    );
    expect(screen.getByText('Sign-in methods for Acme')).toBeTruthy();
    expect(buttonNames()).toEqual(['Continue with OpenFrame', 'Continue with MicrosoftAcme']);
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('keeps the generic providers under the organization heading when it offers them', () => {
    render(
      <LoginForm {...baseProps} ssoProviders={GENERIC} tenantMethods={{ name: 'Acme', providers: ['openframe'] }} />,
    );
    expect(buttonNames()).toEqual([
      'Continue with OpenFrame',
      'Continue with Google',
      'Continue with Microsoft',
      'Continue with Apple',
    ]);
    const heading = screen.getByText('Sign-in methods for Acme');
    const divider = screen.getByText('or continue with');
    expect(precedes(heading, divider)).toBe(true);
  });

  it('drops the second divider when the organization has no buttons of its own above the generic ones', () => {
    render(<LoginForm {...baseProps} ssoProviders={GENERIC} tenantMethods={{ name: 'Acme', providers: [] }} />);
    expect(screen.getByText('Sign-in methods for Acme')).toBeTruthy();
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('names no organization when the name is unknown', () => {
    render(<LoginForm {...baseProps} ssoProviders={[]} tenantMethods={{ providers: ['google'] }} />);
    expect(screen.getByText('Sign-in methods for your organization')).toBeTruthy();
    expect(buttonNames()).toEqual(['Continue with Google']);
  });

  it('disables both blocks with ssoDisabled', () => {
    render(
      <LoginForm
        {...baseProps}
        ssoDisabled
        ssoProviders={GENERIC}
        tenantMethods={{ name: 'Acme', providers: ['openframe'] }}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('LoginForm Enter in the email field', () => {
  it('calls onEmailEnter when there is no submit button', () => {
    const onEmailEnter = vi.fn();
    render(<LoginForm {...baseProps} email="kate@acme.com" onEmailEnter={onEmailEnter} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEmailEnter).toHaveBeenCalledTimes(1);
  });

  it('drives the submit button instead when there is one', () => {
    const onEmailEnter = vi.fn();
    const onSubmitClick = vi.fn();
    render(<LoginForm {...baseProps} onEmailEnter={onEmailEnter} onSubmitClick={onSubmitClick} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSubmitClick).toHaveBeenCalledTimes(1);
    expect(onEmailEnter).not.toHaveBeenCalled();
  });
});

describe('LoginForm notice', () => {
  it('renders the notice as a status row under the field', () => {
    render(<LoginForm {...baseProps} notice="Ask your administrator for an invitation." />);
    expect(screen.getByRole('status').textContent).toContain('Ask your administrator for an invitation.');
  });
});
