import type { SVGProps } from "react";
export interface EarphoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EarphoneIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: EarphoneIconProps) {
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
        d="m10 14.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H7a1.125 1.125 0 0 1 0-2.25zm7 0 .115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M8.875 8A2.875 2.875 0 1 0 6 10.874h1c.62 0 1.124.504 1.125 1.125V18.5a.376.376 0 0 0 .75 0zm12 0a2.875 2.875 0 1 0-5.75 0v10.5a.375.375 0 0 0 .75 0V12c0-.622.504-1.126 1.125-1.126h1A2.874 2.874 0 0 0 20.875 8m-9.75 10.5a2.625 2.625 0 0 1-5.25 0v-5.378A5.123 5.123 0 0 1 6 2.875 5.125 5.125 0 0 1 11.124 8zm12-10.5a5.123 5.123 0 0 1-5 5.122V18.5a2.625 2.625 0 0 1-5.25 0V8a5.126 5.126 0 0 1 10.25 0"
      />
    </svg>
  );
}
