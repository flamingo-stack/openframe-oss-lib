'use client';

import { type ChangeEvent, type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = [Number(e.target.value)];
      onValueChange?.(newValue);
    };

    return (
      <input
        type="range"
        className={cn(
          'flex h-5 w-full cursor-pointer appearance-none items-center rounded-lg bg-secondary outline-none',
          '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
          '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary',
          className,
        )}
        ref={ref}
        value={value[0]}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
