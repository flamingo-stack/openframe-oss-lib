'use client';

import { createElement, useEffect, useSyncExternalStore, type ComponentType } from 'react';
import type { ActionsMenuDropdownProps } from './actions-menu';
import { ActionsMenuTriggerButton } from './actions-menu-trigger';
import { InertWhileLoading } from './loading-scope';

let loaded: ComponentType<ActionsMenuDropdownProps> | null = null;
let loading: Promise<ComponentType<ActionsMenuDropdownProps>> | null = null;
const listeners = new Set<() => void>();

/** Loads the menu's module once; every on-demand menu redraws when it arrives. */
export function loadActionsMenuDropdown(): Promise<ComponentType<ActionsMenuDropdownProps>> {
  loading ??= import('./actions-menu').then(module => {
    loaded = module.ActionsMenuDropdown;
    for (const listener of listeners) listener();
    return module.ActionsMenuDropdown;
  });
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const current = () => loaded;
const onServer = () => null;

/**
 * `ActionsMenuDropdown` whose code (Radix's menu, its popper and floating-ui) loads only where a menu is drawn.
 * `PageActions` sits in every page's container but draws a menu only for a page that has one, so a page without one
 * loads none of it.
 *
 * Until the module has arrived the menu is its trigger, drawn as it will be and inert: the menu's own loading form,
 * and the same box, so nothing moves when it arrives. The server and the browser's first render both draw that form,
 * so hydration matches; a menu drawn after the module has arrived (a later page) is the real one at once.
 */
export function ActionsMenuDropdownOnDemand(props: ActionsMenuDropdownProps) {
  const Menu = useSyncExternalStore(subscribe, current, onServer);
  useEffect(() => {
    if (!Menu) void loadActionsMenuDropdown();
  }, [Menu]);
  if (Menu) return createElement(Menu, props);
  return (
    <InertWhileLoading>
      {props.customTrigger ?? (
        <ActionsMenuTriggerButton
          trigger={props.trigger}
          triggerAriaLabel={props.triggerAriaLabel}
          triggerClassName={props.triggerClassName}
        />
      )}
    </InertWhileLoading>
  );
}
