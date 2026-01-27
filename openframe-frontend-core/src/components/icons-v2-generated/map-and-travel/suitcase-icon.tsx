import type { SVGProps } from "react";
export interface SuitcaseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SuitcaseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SuitcaseIconProps) {
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
        d="M6.875 22v-1.5a1.125 1.125 0 0 1 2.25 0V22a1.125 1.125 0 0 1-2.25 0m8 0v-1.5a1.126 1.126 0 0 1 2.25 0V22a1.125 1.125 0 0 1-2.25 0m-7-5.5V11a1.125 1.125 0 0 1 2.25 0v5.5a1.126 1.126 0 0 1-2.25 0m6 0V11a1.125 1.125 0 0 1 2.25 0v5.5a1.126 1.126 0 0 1-2.25 0m2.25-9.5a1.125 1.125 0 0 1-2.25 0V3.125h-3.75V7a1.125 1.125 0 0 1-2.25 0V3c0-1.173.951-2.125 2.125-2.125h4c1.174 0 2.125.952 2.125 2.125z"
      />
      <path
        fill={color}
        d="M17.875 10c0-1.036-.84-1.875-1.876-1.875H8c-1.036 0-1.875.84-1.875 1.875v7.5c0 1.035.84 1.875 1.875 1.875h8a1.875 1.875 0 0 0 1.875-1.875zm2.25 7.5a4.125 4.125 0 0 1-4.126 4.125H8A4.125 4.125 0 0 1 3.875 17.5V10A4.125 4.125 0 0 1 8 5.875h8A4.125 4.125 0 0 1 20.124 10v7.5Z"
      />
    </svg>
  );
}
