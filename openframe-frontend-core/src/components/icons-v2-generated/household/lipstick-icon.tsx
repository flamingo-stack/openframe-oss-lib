import type { SVGProps } from "react";
export interface LipstickIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LipstickIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LipstickIconProps) {
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
        d="M8.875 14V9A.875.875 0 0 0 8 8.126H6A.875.875 0 0 0 5.125 9v5a1.125 1.125 0 0 1-2.25 0V9c0-.904.386-1.717 1-2.288V4.616c0-1.184.669-2.266 1.728-2.795l1.447-.724.266-.112c1.347-.464 2.808.533 2.808 2.014v3.713A3.11 3.11 0 0 1 11.125 9v5a1.125 1.125 0 0 1-2.25 0m-2.75-8.124h1.75V3.2l-1.266.633a.87.87 0 0 0-.484.782v1.26Z"
      />
      <path
        fill={color}
        d="M9.875 15.126h-5.75V19c0 1.036.84 1.875 1.875 1.875h2c1.035 0 1.875-.84 1.875-1.875zm10-2.126a1.875 1.875 0 0 0-3.75 0v7.875h3.75zm-7.75 6A4.125 4.125 0 0 1 8 23.125H6A4.125 4.125 0 0 1 1.875 19v-4.5c0-.897.727-1.624 1.625-1.624h7c.897 0 1.624.727 1.624 1.624zm10 2.5c0 .898-.727 1.625-1.625 1.625h-5a1.625 1.625 0 0 1-1.625-1.625V13a4.125 4.125 0 0 1 8.25 0z"
      />
    </svg>
  );
}
