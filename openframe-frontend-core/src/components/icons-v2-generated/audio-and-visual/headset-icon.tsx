import type { SVGProps } from "react";
export interface HeadsetIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadsetIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadsetIconProps) {
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
        d="M18.875 17a1.125 1.125 0 0 1 2.25 0A6.125 6.125 0 0 1 15 23.125h-3a1.125 1.125 0 0 1 0-2.25h3A3.875 3.875 0 0 0 18.875 17m0-7a6.876 6.876 0 0 0-13.75 0 1.125 1.125 0 0 1-2.25 0 9.126 9.126 0 0 1 18.25 0 1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 13c0-1.036-.84-1.875-1.875-1.875h-.875v4.75H19c1.035 0 1.874-.84 1.875-1.874zm-17.75 1c0 1.036.84 1.876 1.875 1.876h.875v-4.751H5c-1.036 0-1.875.84-1.875 1.875zm20 0A4.125 4.125 0 0 1 19 18.126h-1A2.126 2.126 0 0 1 15.875 16v-5c0-1.173.952-2.125 2.125-2.125h1A4.125 4.125 0 0 1 23.125 13zm-15 2A2.125 2.125 0 0 1 6 18.125H5a4.125 4.125 0 0 1-4.125-4.124V13A4.125 4.125 0 0 1 5 8.875h1c1.174 0 2.125.952 2.125 2.126z"
      />
    </svg>
  );
}
