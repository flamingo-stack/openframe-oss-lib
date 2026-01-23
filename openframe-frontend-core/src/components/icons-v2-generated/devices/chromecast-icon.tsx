import type { SVGProps } from "react";
export interface ChromecastIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChromecastIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChromecastIconProps) {
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
        d="M20.875 17V7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v1a1.125 1.125 0 0 1-2.25 0V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v10A4.125 4.125 0 0 1 19 21.125h-5a1.125 1.125 0 0 1 0-2.25h5c1.035 0 1.874-.84 1.875-1.875"
      />
      <path
        fill={color}
        d="M5.125 19.75a2.875 2.875 0 0 0-2.582-2.86l-.408-.02a1.125 1.125 0 0 1 .115-2.245l.264.006a5.125 5.125 0 0 1 4.86 5.119 1.125 1.125 0 0 1-2.25 0Zm4 0a6.875 6.875 0 0 0-6.521-6.866l-.354-.009-.115-.006a1.125 1.125 0 0 1 .115-2.244l.47.012a9.125 9.125 0 0 1 8.655 9.113 1.125 1.125 0 0 1-2.25 0m-5.5 0a1.375 1.375 0 0 1-2.743.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.368-1.234l.141.008c.693.07 1.233.655 1.234 1.367"
      />
    </svg>
  );
}
