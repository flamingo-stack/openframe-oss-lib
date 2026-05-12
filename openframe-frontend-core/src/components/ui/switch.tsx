"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../utils/cn"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
>(({ className, checked, onCheckedChange, ...props }, ref) => {
  // Use local state if not controlled
  const [isChecked, setIsChecked] = React.useState(checked || false);
  
  // Update local state when controlled prop changes
  React.useEffect(() => {
    if (checked !== undefined) {
      setIsChecked(checked);
    }
  }, [checked]);

  const handleCheckedChange = (newChecked: boolean) => {
    setIsChecked(newChecked);
    onCheckedChange?.(newChecked);
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-4 w-6 shrink-0 cursor-pointer items-center rounded-full border-2 bg-ods-card px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:cursor-not-allowed disabled:opacity-50",
        isChecked
          ? "border-ods-accent hover:border-ods-accent-hover"
          : "border-ods-text-secondary",
        className,
      )}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block size-2 rounded-full transition-transform duration-200",
          isChecked ? "bg-ods-accent" : "bg-ods-text-secondary",
        )}
        style={{
          transform: isChecked ? "translateX(8px)" : "translateX(0px)"
        }}
      />
    </SwitchPrimitives.Root>
  );
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }