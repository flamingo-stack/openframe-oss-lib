import type { SVGProps } from "react";
export interface AlphabetRIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetRIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetRIconProps) {
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
        d="M15.875 8.5A3.375 3.375 0 0 0 12.5 5.125H9.125v6.75H12.5A3.375 3.375 0 0 0 15.875 8.5m2.25 0a5.63 5.63 0 0 1-3.44 5.183l3.292 5.76.051.102a1.124 1.124 0 0 1-1.942 1.11l-.063-.096-3.675-6.434H9.125V20a1.125 1.125 0 0 1-2.25 0V4.5c0-.898.727-1.625 1.625-1.625h4A5.625 5.625 0 0 1 18.125 8.5"
      />
    </svg>
  );
}
