import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SsoJoinForm } from '../sso-join-form';

beforeAll(() => {
  // jsdom ships no ResizeObserver; the role Tag measures its own label to decide whether it is
  // clipped (and so whether to offer a tooltip).
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const baseProps = {
  name: 'Roman Smith',
  email: 'roman@acme.com',
  organizationName: 'Acme Managed Services',
  roles: ['ADMIN'],
  agreedToTerms: false,
  onAgreedToTermsChange: () => {},
  onSubmit: () => {},
  onBack: () => {},
  termsUrl: 'https://example.com/terms',
  privacyPolicyUrl: 'https://example.com/privacy',
};

describe('SsoJoinForm', () => {
  it('shows who is joining, where, and as what', () => {
    render(<SsoJoinForm {...baseProps} />);
    expect(screen.getByText('Roman Smith')).toBeInTheDocument();
    expect(screen.getByText('Acme Managed Services')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('falls back to the email when the provider gave no name', () => {
    render(<SsoJoinForm {...baseProps} name="" />);
    expect(screen.getByText('roman@acme.com')).toBeInTheDocument();
  });

  it('draws no role tag for a plain member', () => {
    render(<SsoJoinForm {...baseProps} roles={[]} />);
    expect(screen.queryByText('ADMIN')).toBeNull();
  });

  it('links Terms and Privacy Policy in the consent label, opening in a new tab', () => {
    render(<SsoJoinForm {...baseProps} />);
    const terms = screen.getByRole('link', { name: 'Terms' });
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(terms).toHaveAttribute('href', 'https://example.com/terms');
    expect(privacy).toHaveAttribute('href', 'https://example.com/privacy');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('target', '_blank');
  });

  it('keeps Create Account locked until the terms are agreed', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<SsoJoinForm {...baseProps} onSubmit={onSubmit} />);
    const submit = screen.getByRole('button', { name: 'Create Account' });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(<SsoJoinForm {...baseProps} onSubmit={onSubmit} agreedToTerms />);
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('reports the checkbox change to the consumer', () => {
    const onAgreedToTermsChange = vi.fn();
    render(<SsoJoinForm {...baseProps} onAgreedToTermsChange={onAgreedToTermsChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onAgreedToTermsChange).toHaveBeenCalledWith(true);
  });

  it('lets the person walk away with Back to Login', () => {
    const onBack = vi.fn();
    render(<SsoJoinForm {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Login' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('locks both actions while the submit navigates away', () => {
    const onSubmit = vi.fn();
    render(<SsoJoinForm {...baseProps} agreedToTerms loading onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Back to Login' })).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    // The submit too: a second press mid-navigation must not fire another complete.
    const submit = screen.getByRole('button', { name: 'Create Account' });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
