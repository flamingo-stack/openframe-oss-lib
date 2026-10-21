import { render, screen } from '@testing-library/react';
/**
 * Round 4 of the loading standard: static controls (labelled buttons, icon buttons, the "…" trigger) are drawn REAL and
 * inert while their subject loads, and read parts switch themselves (one switch per component).
 */
import { describe, expect, it } from 'vitest';
import { CompleteAccountForm } from '../../features/auth/complete-account-form';
import { SSO_PROVIDERS_SKELETON_COUNT, SsoProviderButtons } from '../../features/auth/sso-providers';
import { OSTypeBadgeGroup } from '../../features/os-type-badge-group';
import { ActionsMenuDropdown } from '../actions-menu';
import { ColorPickerInput } from '../color-preset-select';
import { LoadingItems, LoadingScope } from '../loading-scope';
import { PageActions } from '../page-actions';
import { TicketStatusConfigRow } from '../ticket-status-config-row';

const SURFACE = '.ods-skeleton';
const noop = () => {};

describe('LoadingItems', () => {
  it('draws `count` items, each from its render function', () => {
    const { container } = render(
      <ul>
        <LoadingItems count={3}>{index => <li data-loading-item>{index}</li>}</LoadingItems>
      </ul>,
    );
    expect(container.querySelectorAll('[data-loading-item]')).toHaveLength(3);
    expect(container.textContent).toBe('012');
  });
});

describe('static controls are real and inert while loading', () => {
  it('ActionsMenuDropdown draws its real trigger, inert, and no skeleton', () => {
    const { container } = render(<ActionsMenuDropdown groups={[{ items: [] }]} loading />);
    const trigger = container.querySelector('button[aria-label="More actions"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.closest('[inert]')).not.toBeNull();
    expect(container.querySelector(SURFACE)).toBeNull();
  });

  it('PageActions draws each passed action as its real button, inert, with its label', () => {
    const { container } = render(
      <PageActions
        variant="primary-buttons"
        loading
        actions={[
          { label: 'Edit Script', onClick: noop, variant: 'outline' },
          { label: 'Run Script', onClick: noop },
        ]}
      />,
    );
    expect(screen.getAllByText('Edit Script').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Run Script').length).toBeGreaterThan(0);
    for (const button of container.querySelectorAll('button')) expect(button.closest('[inert]')).not.toBeNull();
    expect(container.querySelector(SURFACE)).toBeNull();
  });

  it('PageActions with an unknown (empty) action set draws one placeholder', () => {
    const { container } = render(<PageActions variant="icon-buttons" loading actions={[]} />);
    expect(container.querySelector(SURFACE)).not.toBeNull();
  });

  it('TicketStatusConfigRow keeps its delete button real and inert, and the custom hex field draws its own box', () => {
    const { container } = render(
      <TicketStatusConfigRow variant="custom" statusKey="x" name="" color="#123456" onColorChange={noop} loading />,
    );
    const remove = container.querySelector('button[aria-label="Delete status"]');
    expect(remove?.closest('[inert]')).not.toBeNull();
    const hex = container.querySelector('[aria-label="Pick custom color"]');
    expect(hex?.closest('[inert]')).not.toBeNull();
    expect(container.textContent).not.toContain('#123456');
  });

  it('ColorPickerInput switches on the scope: its box, a skeleton swatch, no value', () => {
    const { container } = render(
      <LoadingScope>
        <ColorPickerInput value="#abcdef" onChange={noop} />
      </LoadingScope>,
    );
    expect(container.querySelector('[aria-label="Pick custom color"]')).not.toBeNull();
    expect(container.querySelector(SURFACE)).not.toBeNull();
    expect(container.textContent).not.toContain('#abcdef');
  });
});

describe('read parts switch themselves', () => {
  it('SsoProviderButtons draws the typical offer while loading, and every button is a list item', () => {
    const view = render(<SsoProviderButtons providers={[]} loading />);
    expect(view.container.querySelectorAll('[data-loading-item]')).toHaveLength(SSO_PROVIDERS_SKELETON_COUNT);
    view.unmount();
    const { container } = render(<SsoProviderButtons providers={['google', 'microsoft', 'apple']} />);
    expect(container.querySelectorAll('button[data-loading-item]')).toHaveLength(3);
  });

  it('CompleteAccountForm draws one SSO block and one divider in both forms', () => {
    const props = {
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      onFirstNameChange: noop,
      onLastNameChange: noop,
      onPasswordChange: noop,
      onConfirmPasswordChange: noop,
      onSubmit: noop,
      dividerLabel: 'or create account',
    };
    const view = render(<CompleteAccountForm {...props} ssoProvidersLoading />);
    expect(screen.getAllByText('or create account')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-loading-item]')).toHaveLength(SSO_PROVIDERS_SKELETON_COUNT);
    view.unmount();
    render(<CompleteAccountForm {...props} ssoProviders={['google']} />);
    expect(screen.getAllByText('or create account')).toHaveLength(1);
  });

  it("OSTypeBadgeGroup draws one icon's box at its size in a scope", () => {
    const { container } = render(
      <LoadingScope>
        <OSTypeBadgeGroup osTypes={['windows', 'linux']} iconSize="w-4 h-4" />
      </LoadingScope>,
    );
    const boxes = container.querySelectorAll(SURFACE);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].className).toContain('w-4');
    expect(container.querySelector('svg')).toBeNull();
  });
});
