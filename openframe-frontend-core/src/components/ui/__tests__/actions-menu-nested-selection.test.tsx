import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../actions-menu';
import { CollisionBoundaryContext, PortalContainerContext } from '../portal-container';

const pick = vi.fn<(model: string) => void>();
const modelGroup = {
  id: 'model',
  label: 'GPT Alpha',
  description: 'Chat Model',
  type: 'submenu' as const,
  submenuBoundary: 'viewport' as const,
  submenu: [
    {
      id: 'provider',
      label: 'OpenAI',
      type: 'submenu' as const,
      submenu: [
        { id: 'alpha', label: 'GPT Alpha', type: 'radio' as const, checked: true, onClick: () => pick('alpha') },
        { id: 'beta', label: 'GPT Beta', type: 'radio' as const, checked: false, onClick: () => pick('beta') },
      ],
    },
  ],
};
const groups: { items: ActionsMenuItem[] }[] = [{ items: [modelGroup] }];
const ownedPanels: HTMLElement[] = [];
beforeEach(() => {
  // jsdom has no layout; a zero-sized trigger is detached to Floating UI.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 48));
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
});
afterEach(() => {
  vi.restoreAllMocks();
  pick.mockReset();
  for (const panel of ownedPanels.splice(0)) panel.remove();
});

function AnotherLayer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setOpen(false);
    };
    document.addEventListener('keydown', close, { capture: true });
    return () => document.removeEventListener('keydown', close, { capture: true });
  }, []);
  return open ? <div>{children}</div> : <p>Outer panel closed</p>;
}
async function openNested() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Chat actions' }), { button: 0, pointerType: 'mouse' });
  const model = await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
  await waitFor(() => expect(model).toHaveFocus());
  fireEvent.keyDown(model, { key: 'ArrowRight' });
  const provider = await screen.findByRole('menuitem', { name: 'OpenAI' });
  await waitFor(() => expect(provider).toHaveFocus());
  fireEvent.keyDown(provider, { key: 'ArrowRight' });
  await screen.findByRole('menuitemradio', { name: 'GPT Alpha' });
}

function narrowMenuLayout() {
  let viewportWidth = 375;
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => viewportWidth);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement || this === document.body) return new DOMRect(0, 0, viewportWidth, 768);
    const submenu = this.getAttribute('role') === 'menu' && ['left', 'right'].includes(this.dataset.side ?? '');
    return submenu ? new DOMRect(0, 0, 164, 150) : new DOMRect(54, 100, 256, 48);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement || this === document.body) return viewportWidth;
    return this.getAttribute('role') === 'menu' && ['left', 'right'].includes(this.dataset.side ?? '') ? 164 : 256;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(48);
  return (width: number) => {
    viewportWidth = width;
    fireEvent.resize(window);
  };
}

function submenuX(submenu: HTMLElement) {
  return Number(/translate\(([-\d.]+)px,/.exec(submenu.parentElement?.style.transform ?? '')?.[1]);
}

function mouseClick(element: HTMLElement, clientX = 895, clientY = 285) {
  fireEvent.pointerMove(element, { pointerType: 'mouse', clientX, clientY });
  const pointer = fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: 'mouse', clientX, clientY });
  const mouse = fireEvent.mouseDown(element, { button: 0 });
  if (pointer && mouse) act(() => element.focus());
  fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
}

function leftFlippedSubmenuLayout() {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1280);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === document.documentElement || this === document.body) return new DOMRect(0, 0, 1280, 768);
    const text = this.textContent?.replace(/\s/g, '');
    const role = this.getAttribute('role');
    if (role === 'menuitem' && text === 'GPTAlphaChatModel') return new DOMRect(768, 261, 254, 48);
    if (role === 'menuitem' && text === 'OpenAI') return new DOMRect(509, 311, 254, 48);
    if (role === 'menu') {
      const trigger = screen.queryByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
      return trigger && this.getAttribute('aria-labelledby') === trigger.id
        ? new DOMRect(508, 261, 256, 197)
        : new DOMRect(768, 61, 256, 269);
    }
    return new DOMRect(1024, 0, 56, 56);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this === document.documentElement || this === document.body
      ? 1280
      : this.getAttribute('role') === 'menu' || this.hasAttribute('data-radix-popper-content-wrapper')
        ? 256
        : 254;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(48);
}

describe('nested registered menu selections', () => {
  it('keeps the nested model menu open through a real pointer and focus sequence on its provider', async () => {
    leftFlippedSubmenuLayout();
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />);
    mouseClick(screen.getByRole('button', { name: 'Chat actions' }));
    const model = await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
    await waitFor(() => expect(model).toHaveFocus());
    mouseClick(model);
    const provider = await screen.findByRole('menuitem', { name: 'OpenAI' });
    await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await waitFor(() =>
      expect(screen.getByRole('menu', { name: /GPT Alpha.*Chat Model/ })).toHaveAttribute('data-side', 'left'),
    );
    fireEvent.pointerOut(model, { relatedTarget: provider, pointerType: 'mouse', clientX: 636, clientY: 335 });
    fireEvent.pointerOver(provider, { relatedTarget: model, pointerType: 'mouse', clientX: 636, clientY: 335 });
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    mouseClick(provider, 636, 335);
    expect(await screen.findByRole('menuitemradio', { name: 'GPT Beta' })).toBeInTheDocument();
    expect(screen.getAllByRole('menu')).toHaveLength(3);
    expect(pick).not.toHaveBeenCalled();
  });

  it.each([
    { boundary: 'viewport' as const, destination: 'unrelated content' },
    { boundary: 'viewport' as const, destination: 'no target' },
    { boundary: 'viewport' as const, destination: 'non-node target' },
    { boundary: 'surface' as const, destination: 'unrelated content' },
  ])('keeps $boundary submenus dismissible when leaving toward $destination', async ({ boundary, destination }) => {
    leftFlippedSubmenuLayout();
    const scopedGroups = [{ items: [{ ...modelGroup, submenuBoundary: boundary }] }];
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={scopedGroups} />);
    mouseClick(screen.getByRole('button', { name: 'Chat actions' }));
    const model = await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
    await waitFor(() => expect(model).toHaveFocus());
    mouseClick(model);
    await screen.findByRole('menuitem', { name: 'OpenAI' });
    await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    const relatedTarget =
      destination === 'no target' ? null : destination === 'non-node target' ? new EventTarget() : document.body;
    fireEvent.pointerOut(model, { relatedTarget, pointerType: 'mouse', clientX: 636, clientY: 335 });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'OpenAI' })).not.toBeInTheDocument());
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('keeps an opted-in submenu within a narrow viewport and restores normal desktop spacing on resize', async () => {
    const resizeViewport = narrowMenuLayout();
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Chat actions' }), { button: 0, pointerType: 'mouse' });
    const model = await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
    fireEvent.keyDown(model, { key: 'ArrowRight' });
    const submenu = await screen.findByRole('menu', { name: /GPT Alpha.*Chat Model/ });
    await waitFor(() => {
      const x = submenuX(submenu);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + 164).toBeLessThanOrEqual(375);
    });
    resizeViewport(1024);
    await waitFor(() => expect(submenuX(submenu)).toBe(314));
  });

  it('preserves the existing placement for surface submenus without the viewport opt-in', async () => {
    narrowMenuLayout();
    const surfaceGroups = [{ items: [{ ...modelGroup, submenuBoundary: 'surface' as const }] }];
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={surfaceGroups} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Chat actions' }), { button: 0, pointerType: 'mouse' });
    const model = await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ });
    fireEvent.keyDown(model, { key: 'ArrowRight' });
    const submenu = await screen.findByRole('menu', { name: /GPT Alpha.*Chat Model/ });
    await waitFor(() => expect(submenuX(submenu)).toBe(314));
  });

  it('focuses model radios on submenu entry and keeps arrow navigation inside that submenu', async () => {
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />);
    await openNested();
    const alpha = screen.getByRole('menuitemradio', { name: 'GPT Alpha' });
    await waitFor(() => expect(alpha).toHaveFocus());
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'GPT Beta' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'GPT Beta' }), { key: 'Enter' });
    expect(pick).toHaveBeenCalledExactlyOnceWith('beta');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('focuses a hovered radio and preserves its one-shot pointer selection', async () => {
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />);
    await openNested();
    const beta = screen.getByRole('menuitemradio', { name: 'GPT Beta' });
    const move = new MouseEvent('pointermove', { bubbles: true, clientX: 100 });
    Object.defineProperty(move, 'pointerType', { value: 'mouse' });
    fireEvent(beta, move);
    expect(beta).toHaveFocus();
    fireEvent.click(beta);
    expect(pick).toHaveBeenCalledExactlyOnceWith('beta');
  });

  it('previews only a row the user moves to, not the first autofocus on submenu entry', async () => {
    const previewAlpha = vi.fn();
    const previewBeta = vi.fn();
    const provider = modelGroup.submenu[0];
    const items: ActionsMenuItem[] = [
      {
        ...modelGroup,
        submenu: [
          {
            ...provider,
            submenu: provider.submenu.map((item, index) => ({
              ...item,
              onHoverStart: index === 0 ? previewAlpha : previewBeta,
            })),
          },
        ],
      },
    ];
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={[{ items }]} />);
    await openNested();
    const alpha = screen.getByRole('menuitemradio', { name: 'GPT Alpha' });
    await waitFor(() => expect(alpha).toHaveFocus());
    expect(previewAlpha).not.toHaveBeenCalled();
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'GPT Beta' })).toHaveFocus());
    expect(previewBeta).toHaveBeenCalledTimes(1);
    const move = new MouseEvent('pointermove', { bubbles: true, clientX: 100 });
    Object.defineProperty(move, 'pointerType', { value: 'mouse' });
    fireEvent(alpha, move);
    fireEvent.mouseEnter(alpha);
    expect(previewAlpha).toHaveBeenCalledTimes(1);
  });

  it('preserves nested checkboxes, links and independent icon actions without closing retained selections', async () => {
    const checked = vi.fn();
    const linked = vi.fn();
    const inspected = vi.fn();
    const provider = modelGroup.submenu[0];
    const items: ActionsMenuItem[] = [
      {
        ...modelGroup,
        submenu: [
          {
            ...provider,
            submenu: [
              ...provider.submenu,
              { id: 'check', label: 'Remember', type: 'checkbox', onClick: checked },
              { id: 'link', label: 'Reference', href: '#reference', onClick: linked, closeOnSelect: false },
              {
                id: 'inspect',
                label: 'Inspect',
                onClick: () => pick('inspect'),
                iconAction: { icon: <span>↗</span>, 'aria-label': 'Inspect details', onClick: inspected },
              },
            ],
          },
        ],
      },
    ];
    render(<ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={[{ items }]} />);
    await openNested();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remember' }));
    expect(checked).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('menu')).toHaveLength(3);
    const link = screen.getByRole('menuitem', { name: 'Reference' });
    expect(link).toHaveAttribute('href', '#reference');
    fireEvent.click(link);
    expect(linked).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('menu')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect details' }));
    expect(inspected).toHaveBeenCalledTimes(1);
    expect(pick).not.toHaveBeenCalled();
  });

  it('keeps ordinary submenus inside the owning surface by default', async () => {
    const panel = document.createElement('div');
    document.body.append(panel);
    ownedPanels.push(panel);
    const { submenuBoundary: _boundary, ...surfaceGroup } = modelGroup;
    render(
      <PortalContainerContext.Provider value={panel}>
        <CollisionBoundaryContext.Provider value={panel}>
          <ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={[{ items: [surfaceGroup] }]} />
        </CollisionBoundaryContext.Provider>
      </PortalContainerContext.Provider>,
      { container: panel },
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Chat actions' }), { button: 0, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /GPT Alpha.*Chat Model/ }));
    await screen.findByRole('menuitem', { name: 'OpenAI', hidden: true });
    expect(within(panel).getAllByRole('menu', { hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole('menu', { hidden: true })).toHaveLength(2);
  });

  it('portals opted-in nested menus outside the owning panel, leaving the root menu scoped', async () => {
    const panel = document.createElement('div');
    document.body.append(panel);
    ownedPanels.push(panel);
    render(
      <PortalContainerContext.Provider value={panel}>
        <CollisionBoundaryContext.Provider value={panel}>
          <ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />
        </CollisionBoundaryContext.Provider>
      </PortalContainerContext.Provider>,
      { container: panel },
    );
    await openNested();
    // Container placement is independent of jsdom's zero-sized collision boundary.
    expect(within(panel).getAllByRole('menu', { hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole('menu', { hidden: true })).toHaveLength(3);
  });

  it('closes one submenu per Escape and finally returns focus to the real trigger without closing another layer', async () => {
    render(
      <AnotherLayer>
        <ActionsMenuDropdown triggerAriaLabel="Chat actions" groups={groups} />
      </AnotherLayer>,
    );
    await openNested();
    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'GPT Alpha' }), { key: 'Escape' });
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
    expect(screen.getByRole('menuitem', { name: 'OpenAI' })).toHaveFocus();
    expect(screen.queryByText('Outer panel closed')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'OpenAI' }), { key: 'Escape' });
    await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(1));
    expect(screen.getByRole('menuitem', { name: /GPT Alpha.*Chat Model/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /GPT Alpha.*Chat Model/ }), { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chat actions' })).toHaveFocus());
    expect(screen.queryByText('Outer panel closed')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Chat actions' }), { key: 'Escape' });
    expect(screen.getByText('Outer panel closed')).toBeInTheDocument();
  });
});
