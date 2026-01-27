import type { SVGProps } from "react";
export interface UnlockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UnlockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UnlockIconProps) {
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
        d="M6.875 10V6a5.126 5.126 0 0 1 10.088-1.28 1.125 1.125 0 1 1-2.178.56 2.876 2.876 0 0 0-5.66.72v4a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M18.875 13c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 6A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19v-6A4.125 4.125 0 0 1 7 8.875h10A4.125 4.125 0 0 1 21.125 13z"
      />
    </svg>
  );
}
