"use client";

import React, { forwardRef } from 'react';
import { useInteractiveState } from '../hooks/use-interactive-state';
import { cn } from "../utils/cn";

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
  onStateChange?: (state: any) => void;
}

export const InteractiveWrapper = forwardRef<HTMLElement, InteractiveWrapperProps>(({
  interactive = {},
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
}, ref) => {
  const {
    state,
    handlers,
    getStateStyles,
    getStateClasses,
    ripplePosition,
    setLoading,
    setDisabled,
    ref: interactiveRef
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

  const Component = as as any;
  
  const mergedHandlers = {
    ...handlers,
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      handlers.onClick();
      if (onClick && !event.defaultPrevented) {
        onClick(event);
      }
    }
  };

  const computedClassName = cn(
    'interactive-wrapper',
    'relative overflow-hidden transition-all duration-200',
    getStateClasses(),
    focusable && 'focus:outline-none',
    className
  );

  return (
    <Component
      ref={interactiveRef}
      className={computedClassName}
      style={{ ...getStateStyles(), ...props.style }}
      role={role}
      tabIndex={focusable ? 0 : undefined}
      aria-disabled={disabled}
      aria-busy={loading}
      aria-pressed={active}
      {...mergedHandlers}
      {...props}
    >
      {children}
      
      {/* Ripple Effect */}
      {showRipple && ripplePosition && (
        <RippleEffect
          x={ripplePosition.x}
          y={ripplePosition.y}
          color={rippleColor}
        />
      )}
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-current opacity-10 animate-pulse pointer-events-none" />
      )}
    </Component>
  );
});

InteractiveWrapper.displayName = 'InteractiveWrapper';

/**
 * Ripple effect component
 */
function RippleEffect({ 
  x, 
  y, 
  color = 'currentColor' 
}: { 
  x: number; 
  y: number; 
  color?: string; 
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="w-2 h-2 rounded-full animate-ping"
        style={{
          backgroundColor: color,
          opacity: 0.3,
          animationDuration: '0.6s',
          animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          transform: 'scale(0)',
          animation: 'ripple-expand 0.6s cubic-bezier(0, 0, 0.2, 1)'
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
        animations: true
      }}
      className={cn('bg-ods-card border border-ods-border rounded-lg p-4', props.className)}
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
        animations: true
      }}
      className={cn('bg-ods-accent text-ods-text-on-accent px-4 py-2 rounded-md font-medium', props.className)}
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
        animations: true
      }}
      className={cn('block px-3 py-2 rounded-md text-ods-text-secondary hover:text-ods-text-primary', props.className)}
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
        animations: true
      }}
      className={cn('w-full px-3 py-2 bg-ods-bg border border-ods-border rounded-md text-ods-text-primary', props.className)}
      focusable={true}
      {...props}
    />
  )),

  /**
   * Toggle switch with visual feedback
   */
  Toggle: forwardRef<HTMLDivElement, Omit<InteractiveWrapperProps, 'interactive'> & { checked?: boolean }>((props, ref) => {
    const { checked, ...restProps } = props;
    
    return (
      <InteractiveWrapper
        ref={ref}
        interactive={{
          enableAnimations: true,
          enableColorShifts: true,
          enableHapticFeedback: true,
          animations: true
        }}
        className={cn(
          'relative inline-flex w-12 h-6 rounded-full cursor-pointer transition-colors',
          checked ? 'bg-ods-accent' : 'bg-ods-border',
          props.className
        )}
        role="switch"
        aria-checked={checked}
        focusable={true}
        {...restProps}
      >
        <div
          className={cn(
            'inline-block w-5 h-5 rounded-full bg-white transform transition-transform',
            checked ? 'translate-x-6' : 'translate-x-0.5',
            'mt-0.5'
          )}
        />
      </InteractiveWrapper>
    );
  })
};

// Export individual preset components with display names
InteractivePresets.Card.displayName = 'InteractiveCard';
InteractivePresets.Button.displayName = 'InteractiveButton';
InteractivePresets.NavItem.displayName = 'InteractiveNavItem';
InteractivePresets.Input.displayName = 'InteractiveInput';
InteractivePresets.Toggle.displayName = 'InteractiveToggle';