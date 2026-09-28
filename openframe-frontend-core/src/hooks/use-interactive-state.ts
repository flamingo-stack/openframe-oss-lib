import { useState, useCallback, useRef } from 'react';

export interface InteractiveState {
  isHovered: boolean;
  isFocused: boolean;
  isPressed: boolean;
  isActive: boolean;
}

export function useInteractiveState() {
  const [state, setState] = useState<InteractiveState>({
    isHovered: false,
    isFocused: false,
    isPressed: false,
    isActive: false,
  });

  const ref = useRef<HTMLElement>(null);

  const handleMouseEnter = useCallback(() => {
    setState(prev => ({ ...prev, isHovered: true }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, isHovered: false }));
  }, []);

  const handleFocus = useCallback(() => {
    setState(prev => ({ ...prev, isFocused: true }));
  }, []);

  const handleBlur = useCallback(() => {
    setState(prev => ({ ...prev, isFocused: false }));
  }, []);

  const handleMouseDown = useCallback(() => {
    setState(prev => ({ ...prev, isPressed: true }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setState(prev => ({ ...prev, isPressed: false }));
  }, []);

  const setActive = useCallback((active: boolean) => {
    setState(prev => ({ ...prev, isActive: active }));
  }, []);

  return {
    ...state,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onClick: () => {},
    },
    setActive,
    state,
    getStateStyles: () => ({}),
    getStateClasses: () => '',
    ripplePosition: { x: 0, y: 0 },
    // No-ops: this hook tracks hover/focus/press only. The setters exist so
    // callers can keep the full API shape; the arguments are deliberately
    // unread until loading/disabled styling is actually implemented.
    setLoading: (_loading: boolean) => {},
    setDisabled: (_disabled: boolean) => {},
    ref: ref,
  };
}
