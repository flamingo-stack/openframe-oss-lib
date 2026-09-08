'use client';

import React, { forwardRef } from 'react';
import { useInteractiveState, type InteractiveState } from '../hooks/use-interactive-state';
import { cn } from '../utils/cn';

interface InteractiveOptions {
  enableHover?: boolean;
  enableFocus?: boolean;
  enablePress?: boolean;
  enableRipple?: boolean;
  enableAnimations?: boolean;
  enableColorShifts?: boolean;
  enableAccessibilityEnhancements?: boolean;
  animations?: boolean;
  enableHapticFeedback?: boolean;
}

interface InteractiveWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Interactive state options
   */
  interactive?: InteractiveOptions;

  /**
   * Element type to render
   */
  as?: keyof React.JSX.IntrinsicElements;

  /**
   * Whether to render ripple effect
   */
  showRipple?: boolean;

  /**
   * Custom ripple color
   */
  rippleColor?: string;

  /**
   * Accessibility role
   */
  role?: string;

  /**
   * Whether element should be focusable
   */
  focusable?: boolean;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Active state
   */
  active?: boolean;

  /**
   * Callback for state changes
   */
  onStateChange?: (state: InteractiveState) => void;
}

export const InteractiveWrapper = forwardRef<HTMLElement, InteractiveWrapperProps>(
  (
    {
      // Accepted so `Interactive.Card` / `.Button` / `.NavItem` keep their
      // current call shape, but `useInteractiveState()` takes no options
      // today — it tracks hover/focus/press and nothing else. Renaming rather
      // than deleting keeps the key out of the `...props` DOM spread below.
      interactive: _interactive = {},
      as = 'div',
      showRipple = true,
      rippleColor,
      role,
      focusable = false,
      loading = false,
      disabled = false,
      active = false,
      onStateChange,
      className,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const {
      state,
      handlers,
      getStateStyles,
      getStateClasses,
      ripplePosition,
      setLoading,
      setDisabled,
      ref: interactiveRef,
    } = useInteractiveState();

    // Update loading and disabled states
    React.useEffect(() => {
      setLoading(loading);
    }, [loading, setLoading]);

    React.useEffect(() => {
      setDisabled(disabled);
    }, [disabled, setDisabled]);

    // Notify parent of state changes
    React.useEffect(() => {
      if (onStateChange) {
        onStateChange(state);
      }
    }, [state, onStateChange]);

    // Merge refs
    React.useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(interactiveRef.current);
        } else {
          ref.current = interactiveRef.current;
        }
      }
    }, [ref, interactiveRef]);

    const Component = as;

    const mergedHandlers = {
      ...handlers,
      onClick: (event: React.MouseEvent<HTMLDivElement>) => {
        handlers.onClick();
        if (onClick && !event.defaultPrevented) {
          onClick(event);
        }
      },
    };

    const computedClassName = cn(
      'interactive-wrapper',
      'relative overflow-hidden transition-all duration-200',
      getStateClasses(),
      focusable && 'focus:outline-none',
      className,
    );

    // `createElement` rather than `<Component>`: JSX would have to resolve the
    // props (and especially `ref`) against the INTERSECTION of every tag in
    // the `as` union, which has no inhabitant — the old code hid that behind
    // `as any`. The string-tag overload takes the prop bag as written.
    return React.createElement(
      Component,
      {
        ref: interactiveRef,
        className: computedClassName,
        style: { ...getStateStyles(), ...props.style },
        role,
        tabIndex: focusable ? 0 : undefined,
        'aria-disabled': disabled,
        'aria-busy': loading,
        'aria-pressed': active,
        ...mergedHandlers,
        ...props,
      },
      children,
      /* Ripple Effect */
      showRipple && ripplePosition ? (
        <RippleEffect key="ripple" x={ripplePosition.x} y={ripplePosition.y} color={rippleColor} />
      ) : null,
      /* Loading Overlay */
      loading ? (
        <div key="loading" className="pointer-events-none absolute inset-0 animate-pulse bg-current opacity-10" />
      ) : null,
    );
  },
);

InteractiveWrapper.displayName = 'InteractiveWrapper';

/**
 * Ripple effect component
 */
function RippleEffect({ x, y, color = 'currentColor' }: { x: number; y: number; color?: string }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="h-2 w-2 animate-ping rounded-full"
        style={{
          backgroundColor: color,
          opacity: 0.3,
          animationDuration: '0.6s',
          animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          transform: 'scale(0)',
          animation: 'ripple-expand 0.6s cubic-bezier(0, 0, 0.2, 1)',
        }}
      />
    </div>
  );
}

/**
 * Pre-configured interactive components
 */
export const InteractivePresets = {
  /**
   * Card with hover and click interactions
   */
  Card: forwardRef<HTMLDivElement, Omit<InteractiveWrapperProps, 'interactive'>>((props, ref) => (
    <InteractiveWrapper
      ref={ref}
      interactive={{
        enableAnimations: true,
        enableColorShifts: true,
        animations: true,
      }}
      className={cn('rounded-lg border border-ods-border bg-ods-card p-4', props.className)}
      focusable={true}
      role="button"
      {...props}
    />
  )),

  /**
   * Button-like interactive element
   */
  Button: forwardRef<HTMLButtonElement, Omit<InteractiveWrapperProps, 'interactive' | 'as'>>((props, ref) => (
    <InteractiveWrapper
      ref={ref}
      as="button"
      interactive={{
        enableAnimations: true,
        enableColorShifts: true,
        enableAccessibilityEnhancements: true,
        enableHapticFeedback: true,
        animations: true,
      }}
      className={cn('rounded-md bg-ods-accent px-4 py-2 font-medium text-ods-text-on-accent', props.className)}
      role="button"
      {...props}
    />
  )),

  /**
   * Navigation item with subtle interactions
   */
  NavItem: forwardRef<HTMLAnchorElement, Omit<InteractiveWrapperProps, 'interactive' | 'as'>>((props, ref) => (
    <InteractiveWrapper
      ref={ref}
      as="a"
      interactive={{
        enableAnimations: true,
        enableColorShifts: true,
        animations: true,
      }}
      className={cn('block rounded-md px-3 py-2 text-ods-text-secondary hover:text-ods-text-primary', props.className)}
      focusable={true}
      {...props}
    />
  )),

  /**
   * Input field with enhanced focus states
   */
  Input: forwardRef<HTMLInputElement, Omit<InteractiveWrapperProps, 'interactive' | 'as'>>((props, ref) => (
    <InteractiveWrapper
      ref={ref}
      as="input"
      interactive={{
        enableAnimations: false,
        enableColorShifts: true,
        enableAccessibilityEnhancements: true,
        animations: true,
      }}
      className={cn(
        'w-full rounded-md border border-ods-border bg-ods-bg px-3 py-2 text-ods-text-primary',
        props.className,
      )}
      focusable={true}
      {...props}
    />
  )),

  /**
   * Toggle switch with visual feedback
   */
  Toggle: forwardRef<HTMLDivElement, Omit<InteractiveWrapperProps, 'interactive'> & { checked?: boolean }>(
    (props, ref) => {
      const { checked, ...restProps } = props;

      return (
        <InteractiveWrapper
          ref={ref}
          interactive={{
            enableAnimations: true,
            enableColorShifts: true,
            enableHapticFeedback: true,
            animations: true,
          }}
          className={cn(
            'relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors',
            checked ? 'bg-ods-accent' : 'bg-ods-border',
            props.className,
          )}
          role="switch"
          aria-checked={checked}
          focusable={true}
          {...restProps}
        >
          <div
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
              checked ? 'translate-x-6' : 'translate-x-0.5',
              'mt-0.5',
            )}
          />
        </InteractiveWrapper>
      );
    },
  ),
};

// Export individual preset components with display names
InteractivePresets.Card.displayName = 'InteractiveCard';
InteractivePresets.Button.displayName = 'InteractiveButton';
InteractivePresets.NavItem.displayName = 'InteractiveNavItem';
InteractivePresets.Input.displayName = 'InteractiveInput';
InteractivePresets.Toggle.displayName = 'InteractiveToggle';
