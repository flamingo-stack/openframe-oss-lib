import type { SVGProps } from "react";
export interface ConnectionIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ConnectionIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ConnectionIconProps) {
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
        d="M6.457 13.209c.26-.521.872-.75 1.405-.548l.105.045 8.687 4.35.1.058a1.125 1.125 0 0 1-1.003 2.001l-.105-.047-8.687-4.349-.1-.057a1.126 1.126 0 0 1-.402-1.453m9.183-8.293a1.126 1.126 0 0 1 1.008 2.013l-8.69 4.352a1.126 1.126 0 0 1-1.007-2.013z"
      />
      <path
        fill={color}
        d="M20.875 19a1.875 1.875 0 1 0-3.751 0 1.875 1.875 0 0 0 3.75 0Zm-14-7a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m14-7a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 14a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0m-14-7a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0m14-7a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
