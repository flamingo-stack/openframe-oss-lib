import type { SVGProps } from "react";
export interface Parcel01LockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Parcel01LockIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Parcel01LockIconProps) {
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
        d="M10.875 2a1.125 1.125 0 0 1 2.25 0v4.875h8.263l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H2.612a1.125 1.125 0 0 1 0-2.25h8.263z"
      />
      <path
        fill={color}
        d="M16.625 20.875h3.75v-1.75h-3.75zm3.75-10.054v-2.01c0-.248-.05-.495-.145-.723l-.11-.221-2.223-3.812a1.88 1.88 0 0 0-1.62-.93H7.724c-.667 0-1.284.354-1.62.93L3.88 7.867a1.9 1.9 0 0 0-.255.945V19c0 1.035.84 1.875 1.875 1.875h6.098l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H5.5A4.125 4.125 0 0 1 1.375 19V8.812c0-.73.194-1.448.563-2.08l2.222-3.81A4.13 4.13 0 0 1 7.724.874h8.553c1.467 0 2.823.78 3.562 2.046l2.224 3.812.13.24c.284.57.432 1.2.432 1.839v2.01a1.125 1.125 0 0 1-2.25 0m-1.25 4.93a.625.625 0 1 0-1.25 0v1.124h1.25zm2.25 1.313A2.12 2.12 0 0 1 22.625 19v2a2.125 2.125 0 0 1-2.125 2.125h-4A2.124 2.124 0 0 1 14.376 21v-2c0-.862.512-1.602 1.249-1.936v-1.313a2.876 2.876 0 0 1 5.75 0z"
      />
    </svg>
  );
}
