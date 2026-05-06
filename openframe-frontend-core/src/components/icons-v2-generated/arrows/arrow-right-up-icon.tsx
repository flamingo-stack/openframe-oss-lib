import type { SVGProps } from "react";
export interface ArrowRightUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowRightUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ArrowRightUpIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="m16.154 6.255.086-.078a1.125 1.125 0 0 1 1.583 1.583l-.078.086-9.9 9.899a1.125 1.125 0 1 1-1.59-1.591z"
      />
      <path
        fill={color}
        d="M7.34 7.05c0-.582.442-1.062 1.01-1.12l.115-.005h8.485a1.124 1.124 0 0 1 1.125 1.125v8.485a1.125 1.125 0 1 1-2.25 0v-7.36h-7.36L8.35 8.17a1.125 1.125 0 0 1-1.01-1.12"
      />
    </svg>
  );
}
