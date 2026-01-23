import type { SVGProps } from "react";
export interface HospitalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HospitalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HospitalIconProps) {
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
        d="M1.875 21V6A4.125 4.125 0 0 1 6 1.875h5a4.12 4.12 0 0 1 4.119 4H19A3.125 3.125 0 0 1 22.125 9v12a1.125 1.125 0 0 1-2.25 0v-4.875H18a1.125 1.125 0 0 1 0-2.25h1.875v-1.75H18a1.125 1.125 0 0 1 0-2.25h1.875V9A.875.875 0 0 0 19 8.125h-3.876V21a1.125 1.125 0 0 1-2.25 0V6a1.874 1.874 0 0 0-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v15a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M9.375 17a.876.876 0 1 0-1.75 0v2.875h1.75zm-2-6v-.876H6.5a1.125 1.125 0 1 1 0-2.25h.875V7a1.125 1.125 0 0 1 2.25 0v.875h.876l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-.876v.877a1.125 1.125 0 0 1-2.25 0Zm4.25 8.875H22l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H2a1.125 1.125 0 0 1 0-2.25h3.375V17a3.126 3.126 0 1 1 6.25 0z"
      />
    </svg>
  );
}
