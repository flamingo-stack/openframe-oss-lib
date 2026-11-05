import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackButton } from '../back-button';

/**
 * `historyBack`: the click goes back the way the browser's own button does when this tab has an earlier page of the
 * same site, and follows `href` otherwise (a shared link, a new tab) or when the visitor asked for a new tab.
 */
type NavigationStub = { canGoBack: boolean; currentEntry: { index: number } };

const setNavigation = (navigation: NavigationStub | undefined) => {
  Object.defineProperty(window, 'navigation', { value: navigation, configurable: true, writable: true });
};

describe('BackButton historyBack', () => {
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  });
  afterEach(() => {
    back.mockRestore();
    setNavigation(undefined);
  });

  it('goes back when the tab has an earlier page of this site', () => {
    setNavigation({ canGoBack: true, currentEntry: { index: 2 } });
    render(<BackButton href="/list" label="Back to list" historyBack />);
    const followed = fireEvent.click(screen.getByRole('link', { name: /Back to list/ }));
    expect(back).toHaveBeenCalledOnce();
    expect(followed).toBe(false);
  });

  it('follows the link when there is no earlier page of this site', () => {
    setNavigation({ canGoBack: false, currentEntry: { index: 0 } });
    render(<BackButton href="/list" label="Back to list" historyBack />);
    fireEvent.click(screen.getByRole('link', { name: /Back to list/ }));
    expect(back).not.toHaveBeenCalled();
  });

  it('keeps a modified click (a new tab) as the link', () => {
    setNavigation({ canGoBack: true, currentEntry: { index: 2 } });
    render(<BackButton href="/list" label="Back to list" historyBack />);
    fireEvent.click(screen.getByRole('link', { name: /Back to list/ }), { metaKey: true });
    expect(back).not.toHaveBeenCalled();
  });

  it('is a plain link without historyBack', () => {
    setNavigation({ canGoBack: true, currentEntry: { index: 2 } });
    render(<BackButton href="/list" label="Back to list" />);
    fireEvent.click(screen.getByRole('link', { name: /Back to list/ }));
    expect(back).not.toHaveBeenCalled();
  });
});
