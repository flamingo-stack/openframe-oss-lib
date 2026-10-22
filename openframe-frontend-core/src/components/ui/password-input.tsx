'use client';

import { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { EyeIcon } from '../icons-v2-generated/interface/eye-icon';
import { EyeOffIcon } from '../icons-v2-generated/interface/eye-off-icon';
import { Button } from './button';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'endAdornment'>;

/** Password field with a show/hide toggle (eye icon), built on the base Input. */
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ disabled, className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      disabled={disabled}
      // Ellipsize an over-long password/value when the field isn't focused (per the mockup)
      className={cn('[&_input]:text-ellipsis', className)}
      endAdornment={
        <Button
          variant="transparent"
          size="icon-sm"
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(value => !value)}
        >
          <Icon className="text-ods-text-secondary" />
        </Button>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
