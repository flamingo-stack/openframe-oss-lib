'use client';

/** Fae's one-click attach button in the OpenFrame composer's input. */

import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { Button } from '../ui/button';

export interface OpenFrameAttachButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** Fae's one-click `+` in the input: opens the file picker, no menu. */
export function OpenFrameAttachButton({ onClick, disabled = false }: OpenFrameAttachButtonProps) {
  return (
    <Button
      variant="bare"
      data-tone="accent"
      size="icon-sm"
      type="button"
      aria-label="Attach a file"
      title="Attach a file"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0"
    >
      <PlusIcon />
    </Button>
  );
}
