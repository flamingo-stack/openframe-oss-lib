import type { SVGProps } from "react";
export interface PlusMultipleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PlusMultipleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PlusMultipleIconProps) {
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
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 10A4.126 4.126 0 0 1 19 23.125H9A4.125 4.125 0 0 1 4.875 19V9A4.125 4.125 0 0 1 9 4.875h10A4.125 4.125 0 0 1 23.125 9z"
      />
      <path
        fill={color}
        d="M.875 18V9A8.126 8.126 0 0 1 9 .875h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 3.125H9A5.876 5.876 0 0 0 3.124 9v9a1.125 1.125 0 0 1-2.25 0Zm12-1v-1.875H11a1.125 1.125 0 0 1 0-2.25h1.875V11a1.125 1.125 0 0 1 2.25 0v1.875H17a1.125 1.125 0 0 1 0 2.25h-1.875V17a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
