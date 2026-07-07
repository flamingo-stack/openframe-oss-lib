"use client"

import * as React from "react"
import { cn } from "../../utils/cn"
import { EyeIcon } from "../icons-v2-generated/interface/eye-icon"
import { EyeOffIcon } from "../icons-v2-generated/interface/eye-off-icon"
import { Input, type InputProps } from "./input"

export type PasswordInputProps = Omit<InputProps, "type" | "endAdornment">

/** Password field with a show/hide toggle (eye icon), built on the base Input. */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ disabled, className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOffIcon : EyeIcon

  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      disabled={disabled}
      // Ellipsize an over-long password/value when the field isn't focused (per the mockup)
      className={cn("[&_input]:text-ellipsis", className)}
      endAdornment={
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((value) => !value)}
          className="flex items-center text-ods-text-secondary transition-colors hover:text-ods-text-primary disabled:cursor-not-allowed"
        >
          <Icon className="h-6 w-6" />
        </button>
      }
      {...props}
    />
  )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
