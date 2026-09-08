import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
