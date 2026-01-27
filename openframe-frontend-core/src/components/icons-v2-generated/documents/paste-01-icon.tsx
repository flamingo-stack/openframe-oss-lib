import type { SVGProps } from "react";
export interface Paste01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Paste01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Paste01IconProps) {
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
        d="M6.875 19v-3a1.125 1.125 0 0 1 2.25 0v3l.01.191A1.874 1.874 0 0 0 11 20.875h8c1.035 0 1.875-.84 1.875-1.875v-8c0-.97-.738-1.769-1.684-1.865L19 9.125h-3a1.125 1.125 0 0 1 0-2.25h3l.421.022A4.124 4.124 0 0 1 23.125 11v8A4.125 4.125 0 0 1 19 23.125h-8a4.124 4.124 0 0 1-4.103-3.704z"
      />
      <path
        fill={color}
        d="M14.874 5a1.874 1.874 0 0 0-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h8a1.874 1.874 0 0 0 1.874-1.875zm2.25 8A4.125 4.125 0 0 1 13 17.124H5a4.125 4.125 0 0 1-4.125-4.126V5A4.125 4.125 0 0 1 5 .875h8A4.125 4.125 0 0 1 17.124 5z"
      />
    </svg>
  );
}
