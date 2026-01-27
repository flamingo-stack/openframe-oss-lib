import type { SVGProps } from "react";
export interface MoneyBillIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MoneyBillIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MoneyBillIconProps) {
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
        d="M20.875 8c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.876zm2.25 8A4.125 4.125 0 0 1 19 20.124H5a4.125 4.125 0 0 1-4.125-4.126V8A4.125 4.125 0 0 1 5 3.875h14A4.125 4.125 0 0 1 23.125 8z"
      />
      <path
        fill={color}
        d="M13.874 12a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m-9.499.5v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m13 0v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m-1.25-.5a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
