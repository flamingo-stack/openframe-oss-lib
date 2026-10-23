import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompactAuthShell } from '../compact-auth-shell';
import { NoAccountNotice } from '../no-account-notice';
import { SsoJoinForm } from '../sso-join-form';

describe('SsoJoinForm consent wording', () => {
  const baseProps = {
    organizationName: 'Acme',
    agreedToTerms: false,
    onAgreedToTermsChange: () => {},
    onSubmit: () => {},
    onBack: () => {},
  };

  it('keeps "by signing up" by default', () => {
    render(<SsoJoinForm {...baseProps} />);
    expect(screen.getByText(/by signing up\./)).toBeTruthy();
  });

  it('takes the closing words from termsSuffix when given', () => {
    render(<SsoJoinForm {...baseProps} termsSuffix=" by joining." />);
    expect(screen.getByText(/by joining\./)).toBeTruthy();
    expect(screen.queryByText(/signing up/)).toBeNull();
  });
});

describe('CompactAuthShell', () => {
  it('renders the card under the default tagline', () => {
    render(
      <CompactAuthShell>
        <div>card</div>
      </CompactAuthShell>,
    );
    expect(screen.getByText('card')).toBeTruthy();
    expect(screen.getByText('All your MSP ops in one place.')).toBeTruthy();
  });

  it('renders no tagline when the tagline is explicitly empty', () => {
    render(
      <CompactAuthShell tagline={null}>
        <div>card</div>
      </CompactAuthShell>,
    );
    expect(screen.queryByText('All your MSP ops in one place.')).toBeNull();
  });
});

describe('NoAccountNotice', () => {
  it('offers only the way back to login, and never anything that creates an account', () => {
    const onBackToLogin = vi.fn();
    render(<NoAccountNotice onBackToLogin={onBackToLogin} />);

    expect(screen.getByRole('heading', { name: 'No account found' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Login' }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
